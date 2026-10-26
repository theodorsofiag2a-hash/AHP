import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Client Supabase para Server Components / Server Actions / Route Handlers,
 * respeitando a sessão do usuário (e portanto as políticas de RLS).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // httpOnly: o app não usa o client de navegador do Supabase (lib/supabase/client.ts
      // não é importado em lugar nenhum hoje) — nada precisa ler este cookie via JS. Isso
      // reduz o impacto de um XSS futuro (ver docs/SECURITY_AUDIT.md, achado S12).
      cookieOptions: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // chamado de um Server Component sem permissão de escrita de cookie;
            // o middleware cuida de renovar a sessão nesse caso.
          }
        },
      },
    }
  );
}
