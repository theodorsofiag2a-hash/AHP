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

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Retorno do link "esqueci minha senha": o pedido deixou um cookie e o código troca por uma sessão.
      const cookieStore = await cookies();
      if (cookieStore.get(RECOVERY_COOKIE)) {
        cookieStore.delete({ name: RECOVERY_COOKIE, path: RECOVERY_COOKIE_PATH });
        return NextResponse.redirect(`${origin}/redefinir-senha`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Falha ao confirmar autenticação`);
}
