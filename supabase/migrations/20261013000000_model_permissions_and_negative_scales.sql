-- Permite escalas com penalidade (valores negativos), ex: -100 para "Informação não
-- disponível" ou pior caso, derrubando a nota final do pilar/alternativa.
alter table ahp_scales drop constraint if exists ahp_scales_fulfillment_pct_check;
alter table ahp_scales add constraint ahp_scales_fulfillment_pct_check
  check (fulfillment_pct >= -100 and fulfillment_pct <= 100);

-- ============================================================================
-- Gestão de estrutura (pilares/subcritérios/escalas) restrita a owner/admin;
-- qualquer membro da organização continua podendo ler a estrutura (necessário
-- para rodar a matriz e preencher fichas de avaliação) e fazer CRUD de
-- alternativas/avaliações normalmente.
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

-- ahp_models
drop policy if exists ahp_models_all on ahp_models;

create policy ahp_models_select on ahp_models
  for select using (public.is_org_member(organization_id));
create policy ahp_models_insert on ahp_models
  for insert with check (public.is_org_admin(organization_id));
create policy ahp_models_update on ahp_models
  for update using (public.is_org_admin(organization_id)) with check (public.is_org_admin(organization_id));
create policy ahp_models_delete on ahp_models
  for delete using (public.is_org_admin(organization_id));

-- ahp_pillars
drop policy if exists ahp_pillars_all on ahp_pillars;

create policy ahp_pillars_select on ahp_pillars
  for select using (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_member(m.organization_id))
  );
create policy ahp_pillars_insert on ahp_pillars
  for insert with check (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_admin(m.organization_id))
  );
create policy ahp_pillars_update on ahp_pillars
  for update using (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_admin(m.organization_id))
  ) with check (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_admin(m.organization_id))
  );
create policy ahp_pillars_delete on ahp_pillars
  for delete using (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_admin(m.organization_id))
  );

-- ahp_subcriteria
drop policy if exists ahp_subcriteria_all on ahp_subcriteria;

create policy ahp_subcriteria_select on ahp_subcriteria
  for select using (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_member(m.organization_id)
    )
  );
create policy ahp_subcriteria_insert on ahp_subcriteria
  for insert with check (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_admin(m.organization_id)
    )
  );
create policy ahp_subcriteria_update on ahp_subcriteria
  for update using (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_admin(m.organization_id)
    )
  ) with check (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_admin(m.organization_id)
    )
  );
create policy ahp_subcriteria_delete on ahp_subcriteria
  for delete using (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_admin(m.organization_id)
    )
  );

-- ahp_scales
drop policy if exists ahp_scales_all on ahp_scales;

create policy ahp_scales_select on ahp_scales
  for select using (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_member(m.organization_id)
    )
  );
create policy ahp_scales_insert on ahp_scales
  for insert with check (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_admin(m.organization_id)
    )
  );
create policy ahp_scales_update on ahp_scales
  for update using (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_admin(m.organization_id)
    )
  ) with check (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_admin(m.organization_id)
    )
  );
create policy ahp_scales_delete on ahp_scales
  for delete using (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_admin(m.organization_id)
    )
  );
