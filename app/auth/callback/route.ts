import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { RECOVERY_COOKIE, RECOVERY_COOKIE_PATH } from "@/lib/password";

/**
 * `next` vem do query string (controlado pelo link que a vítima clicou, não pelo app) e
 * nunca deve virar um redirect para fora do próprio site (open redirect/phishing). Só
 * aceitamos um caminho relativo que comece com "/" e não com "//" ou "/\" — qualquer um
 * desses prefixos é interpretado por navegadores como referência a outro host.
 */
function safeNextPath(value: string | null): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/")) return "/dashboard";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  return value;
}

const LINK_USED = "Este link já foi usado ou expirou. Se você já confirmou o e-mail, é só entrar com e-mail e senha.";
const RECOVERY_FAILED = "O link de redefinição expirou, já foi usado ou foi aberto em outro navegador. Peça um novo.";
const EMAIL_CONFIRMED = "E-mail confirmado! Entre com seu e-mail e senha.";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));
  const cookieStore = await cookies();
  const isRecovery = Boolean(cookieStore.get(RECOVERY_COOKIE));

  // O Supabase devolve o erro na própria URL (ex.: link já usado ou vencido: error_code=otp_expired).
  const linkError = searchParams.get("error_code") ?? searchParams.get("error");

  if (code && !linkError) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Retorno do link "esqueci minha senha": o pedido deixou um cookie e o código troca por uma sessão.
      if (isRecovery) {
        cookieStore.delete({ name: RECOVERY_COOKIE, path: RECOVERY_COOKIE_PATH });
        return NextResponse.redirect(`${origin}/redefinir-senha`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  if (isRecovery) {
    cookieStore.delete({ name: RECOVERY_COOKIE, path: RECOVERY_COOKIE_PATH });
    return NextResponse.redirect(`${origin}/esqueci-senha?error=${encodeURIComponent(RECOVERY_FAILED)}`);
  }

  // Com o código em mãos, o Supabase já confirmou o e-mail; o que falhou foi só o login automático
  // (link aberto em outro navegador/aparelho, sem o verificador do PKCE). A pessoa já pode entrar.
  if (code && !linkError) {
    return NextResponse.redirect(`${origin}/login?info=${encodeURIComponent(EMAIL_CONFIRMED)}`);
  }

  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(LINK_USED)}`);
}
