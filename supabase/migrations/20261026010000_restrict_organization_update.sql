-- ============================================================================
-- Correção de segurança (auditoria 2026-10-26, docs/SECURITY_AUDIT.md, achado S7):
-- organizations_update permitia que QUALQUER membro (role "member" incluído, não só
-- owner/admin) alterasse nome, slug e e-mail de cobrança da própria organização via
-- PATCH direto no PostgREST. Não há hoje nenhuma tela que edite esses campos (ver
-- app/(app)/settings/organization/page.tsx, só leitura), então restringir a policy não
-- tem impacto funcional — é puramente fechar uma escrita que a RLS deixava aberta demais.
--
-- Não recria permissão de escrita em ahp_models/ahp_pillars/ahp_subcriteria/ahp_scales:
-- essas continuam travadas para todo mundo (migration 20261013010000), por desenho.
-- ============================================================================

create or replace function public.is_org_admin(p_organization_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_result boolean;
begin
  select exists (
    select 1
    from organization_members om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.role in ('owner', 'admin')
  ) into v_result;
  return v_result;
end;
$$;

revoke execute on function public.is_org_admin(uuid) from public;
grant execute on function public.is_org_admin(uuid) to authenticated, service_role;

drop policy if exists organizations_update on organizations;
create policy organizations_update on organizations
  for update using (public.is_org_admin(id)) with check (public.is_org_admin(id));
