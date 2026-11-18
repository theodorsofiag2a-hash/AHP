import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface UserContext {
  userId: string;
  userEmail: string | null;
  /** Nome para exibir: o informado no cadastro (se houver) ou a parte local do e-mail. */
  userName: string;
}

/** Resolve o usuário autenticado. Redireciona para /login se não houver sessão. */
export async function requireUserContext(): Promise<UserContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const email = user.email ?? null;
  const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name.trim() : "";

  return {
    userId: user.id,
    userEmail: email,
    userName: metaName || (email ? email.split("@")[0] : "usuário"),
  };
}
