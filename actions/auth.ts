"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  RECOVERY_COOKIE,
  RECOVERY_COOKIE_MAX_AGE_SECONDS,
  RECOVERY_COOKIE_PATH,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "@/lib/password";

const GENERIC_AUTH_ERROR = "Não foi possível concluir. Verifique os dados e tente novamente.";

/**
 * Mapeia só os erros do Supabase Auth que são seguros de expor (não confirmam nem negam
 * a existência de uma conta) para uma mensagem em pt-BR. Qualquer outro erro vira a
 * mensagem genérica acima — não repassamos o texto cru do Supabase, que pode vazar
 * detalhes internos ou, no caso de signup, permitir enumerar e-mails já cadastrados
 * (ver docs/SECURITY_AUDIT.md, achado S9).
 */
function friendlyLoginError(message: string): string {
  if (message === "Email not confirmed") {
    return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.";
  }
  if (message === "Invalid login credentials") {
    return "E-mail ou senha incorretos.";
  }
  return GENERIC_AUTH_ERROR;
}

const signUpSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
  // O servidor é a validação que vale de verdade; o minLength do formulário é só UX
  // (ver docs/SECURITY_AUDIT.md, achado S8 — antes disto, um POST direto contornava o
  // mínimo de 8 caracteres do HTML).
  password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
  organizationName: z.string().trim().min(1, "Informe o nome da empresa.").max(120, "Nome da empresa muito longo."),
});

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent(friendlyLoginError(error.message))}`);
  }

  redirect("/dashboard");
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    organizationName: String(formData.get("organizationName") ?? "").trim(),
  });

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Dados inválidos.";
    redirect(`/signup?error=${encodeURIComponent(message)}`);
  }

  const { email, password, organizationName } = parsed.data;

  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { organization_name: organizationName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    // Mensagem única para qualquer falha de signup — inclusive "e-mail já cadastrado" —
    // para não confirmar a existência de uma conta a quem não é o dono dela.
    redirect(`/signup?error=${encodeURIComponent(GENERIC_AUTH_ERROR)}`);
  }

  redirect("/signup/verifique-seu-email");
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const origin = (await headers()).get("origin");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data?.url) {
    redirect(`/login?error=${encodeURIComponent("Falha ao iniciar login com Google.")}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Sempre responde "enviado" quando o e-mail é válido, exista conta ou não, para não revelar
 * quais e-mails estão cadastrados (mesma lógica do achado S9). O cookie marca que o próximo
 * retorno em /auth/callback é uma redefinição e deve ir para /redefinir-senha.
 */
export async function requestPasswordReset(formData: FormData) {
  const parsed = forgotPasswordSchema.safeParse({ email: String(formData.get("email") ?? "") });
  if (!parsed.success) {
    redirect(`/esqueci-senha?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "E-mail inválido.")}`);
  }

  const origin = (await headers()).get("origin");
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback`,
  });

  if (error?.status === 429) {
    redirect(
      `/esqueci-senha?error=${encodeURIComponent("Muitos pedidos seguidos. Aguarde alguns minutos e tente novamente.")}`
    );
  }

  (await cookies()).set(RECOVERY_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: RECOVERY_COOKIE_PATH,
    maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
  });

  redirect("/esqueci-senha?enviado=1");
}

export async function updatePassword(formData: FormData) {
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) {
    redirect(`/redefinir-senha?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/esqueci-senha?error=${encodeURIComponent("O link expirou. Peça um novo para redefinir a senha.")}`);
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    const message =
      error.code === "same_password"
        ? "A nova senha precisa ser diferente da atual."
        : error.code === "weak_password"
          ? "Senha fraca. Use uma senha mais difícil de adivinhar."
          : GENERIC_AUTH_ERROR;
    redirect(`/redefinir-senha?error=${encodeURIComponent(message)}`);
  }

  // Quem esqueceu a senha pode ter outra sessão aberta em lugar indevido: encerra as demais.
  await supabase.auth.signOut({ scope: "others" });

  redirect("/dashboard");
}
