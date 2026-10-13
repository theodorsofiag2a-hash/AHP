import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface OrgContext {
  userId: string;
  userEmail: string | null;
  organizationId: string;
  role: "owner" | "admin" | "member";
  organizationName: string;
  organizationSlug: string;
}

/** Resolve o usuário autenticado e sua organização ativa. Redireciona para /login se não houver sessão/organização. */
export async function requireOrgContext(): Promise<OrgContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role, organizations(name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!membership || !membership.organizations) redirect("/login");

  const organization = Array.isArray(membership.organizations)
    ? membership.organizations[0]
    : membership.organizations;

  return {
    userId: user.id,
    userEmail: user.email ?? null,
    organizationId: membership.organization_id,
    role: membership.role as OrgContext["role"],
    organizationName: organization.name,
    organizationSlug: organization.slug,
  };
}

/** Owner/admin podem gerir a estrutura dos modelos (pilares/subcritérios/escalas); member só consome. */
export function canManageModels(role: OrgContext["role"]): boolean {
  return role === "owner" || role === "admin";
}
