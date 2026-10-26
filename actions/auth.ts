"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

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
