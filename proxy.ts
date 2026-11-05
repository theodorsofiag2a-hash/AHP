import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/signup/verifique-seu-email", "/esqueci-senha", "/auth/callback"];

// Chamado pelo Asaas, sem cookie de sessão: a rota se autentica sozinha (header asaas-access-token).
// Sem esta saída o proxy responderia 307 -> /login e a fila de webhooks do Asaas pausaria após 15 falhas.
const WEBHOOK_PATHS = ["/api/webhooks/asaas"];

export async function proxy(request: NextRequest) {
  if (WEBHOOK_PATHS.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Precisa bater exatamente com lib/supabase/server.ts — o proxy também escreve/renova
      // este cookie, e atributos divergentes entre os dois criariam cookies duplicados.
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some(
    (path) => request.nextUrl.pathname === path || request.nextUrl.pathname.startsWith("/auth/")
  );

  if (!user && !isPublicPath) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
