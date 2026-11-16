-- ============================================================================
-- Nota dinâmica relativa à carteira (EUST e alíquota de ICMS do Parametros_Consolidado v2).
--
-- Em vez de escolher uma faixa na ficha, o subcritério "relativo" recebe um VALOR por
-- alternativa (projeto). A nota (0-100) só é calculada ao rodar a análise, comparando todos
-- os projetos do modelo: o menor valor da carteira recebe 100, o maior recebe 0 e os demais
-- ficam em interpolação linear. A estrutura do modelo continua só gravável por service_role.
--
--   score_mode = 'scale'          -> comportamento de sempre (escolhe uma faixa/escala)
--   score_mode = 'relative_lower' -> informa um valor; menor é melhor
-- ============================================================================

alter table ahp_subcriteria
  add column score_mode text not null default 'scale' check (score_mode in ('scale', 'relative_lower')),
  add column value_unit text;

create table ahp_alternative_values (
  id uuid primary key default gen_random_uuid(),
  alternative_id uuid not null references ahp_alternatives(id) on delete cascade,
  subcriterion_id uuid not null references ahp_subcriteria(id) on delete cascade,
  raw_value numeric(16, 4) not null check (raw_value >= 0),
  updated_at timestamptz not null default now(),
  unique (alternative_id, subcriterion_id)
);

create index idx_ahp_alternative_values_alternative on ahp_alternative_values(alternative_id);

alter table ahp_alternative_values enable row level security;

-- Mesma regra de ahp_alternative_scores (S6): a alternativa é da organização, o subcritério é do
-- mesmo modelo da alternativa, e além disso o subcritério precisa ser do tipo relativo.
create policy ahp_alternative_values_all on ahp_alternative_values
  for all using (
    exists (
      select 1 from ahp_alternatives a
      join ahp_models m on m.id = a.model_id
      where a.id = ahp_alternative_values.alternative_id and public.is_org_member(m.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from ahp_alternatives a
      join ahp_models m on m.id = a.model_id
      join ahp_subcriteria s on s.id = ahp_alternative_values.subcriterion_id
        and s.score_mode = 'relative_lower'
        and s.pillar_id in (select p.id from ahp_pillars p where p.model_id = a.model_id)
      where a.id = ahp_alternative_values.alternative_id
        and public.is_org_member(m.organization_id)
    )
  );

revoke all on ahp_alternative_values from anon;
grant select, insert, update, delete on ahp_alternative_values to authenticated;
grant all on ahp_alternative_values to service_role;
