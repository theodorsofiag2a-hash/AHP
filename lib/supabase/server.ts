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
