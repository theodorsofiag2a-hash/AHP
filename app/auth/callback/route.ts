import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=Falha ao confirmar autenticação`);
}
