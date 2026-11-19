-- Licenciamento estadual (v3 da planilha de parâmetros), trial e ajuste manual com justificativa.
--  * licensing_rules: base de licenciamento por UF (ref. 10/11/2026). Atualizada pelo administrador
--    (service role), sem alterar código; qualquer conta logada lê.
--  * O parâmetro "Regra estadual de licenciamento" vira dois: triagem (peso 15, não pontua) e
--    complexidade do rito (peso 20, pontua e é preenchida pela UF do município do projeto).
--  * ahp_subcriteria.trial marca os parâmetros liberados na versão gratuita (trial).
--  * ahp_alternative_scores guarda quem ajustou uma nota automática, quando e por quê.

-- ============================================================================
-- 1. Base de licenciamento por UF
-- ============================================================================
create table licensing_rules (
  uf text primary key check (char_length(uf) = 2),
  state_name text not null,
  region text,
  environmental_agency text,
  legal_basis text,
  has_specific_norm text,
  original_classification text,
  rite text not null check (rite in ('dispensa', 'simplificado', 'trifasico', 'em_elaboracao', 'em_consulta', 'nao_informado')),
  notes text,
  reference_date date not null default date '2026-11-10',
  updated_at timestamptz not null default now()
);

create trigger trg_licensing_rules_updated_at
before update on licensing_rules
for each row execute function public.set_updated_at();

alter table licensing_rules enable row level security;
create policy licensing_rules_select on licensing_rules for select to authenticated using (true);
revoke all on licensing_rules from anon;
revoke insert, update, delete, truncate on licensing_rules from authenticated;
grant all on licensing_rules to service_role;

insert into licensing_rules
  (uf, state_name, region, environmental_agency, legal_basis, has_specific_norm, original_classification, rite, notes)
values
  ('AC', 'Acre', 'Norte', 'IMAC', null, null, 'Não-Analogia', 'em_consulta', null),
  ('AP', 'Amapá', 'Norte', 'SEMA-AP', 'Resolução COEMA nº 62/2024', null, 'Não-Analogia', 'em_consulta', null),
  ('AM', 'Amazonas', 'Norte', 'IPAAM', null, null, 'Não-Analogia', 'em_consulta', null),
  ('PA', 'Pará', 'Norte', 'SEMAS', null, null, 'Não-Analogia', 'em_consulta', null),
  ('RO', 'Rondônia', 'Norte', 'SEDAM', 'Lei nº 3686/2015', null, 'Não-Analogia', 'trifasico', 'Enquadramento original: ''Enquadramento 79.9 Geração de Energia a partir de Fonte Solar''. Colunas deslocadas no documento original.'),
  ('RR', 'Roraima', 'Norte', 'FEMARH', null, 'Em consulta', 'Consulta', 'em_consulta', null),
  ('TO', 'Tocantins', 'Norte', 'SEMARH-TO', 'Resolução COEMA/TO nº 07/2005', null, 'Não-Analogia — Obras Civis não Lineares - Subestação', 'nao_informado', 'Colunas deslocadas no documento original; rito não confirmado.'),
  ('AL', 'Alagoas', 'Nordeste', 'IMA', null, null, 'Não-Analogia', 'em_consulta', null),
  ('BA', 'Bahia', 'Nordeste', 'INEMA', 'Decreto 24.306/2026', 'Sim', 'E2.8 Armazenamento de Energia', 'trifasico', null),
  ('CE', 'Ceará', 'Nordeste', 'SEMACE', 'Lei 19.849/2026', 'Sim', 'Sistema de Armazenamento de Energia', 'trifasico', null),
  ('MA', 'Maranhão', 'Nordeste', 'SEMA-MA', null, null, 'Outras unidades ou atividades de apoio à geração, transmissão e distribuição de energia elétrica', 'nao_informado', null),
  ('PB', 'Paraíba', 'Nordeste', 'SUDEMA', 'Norma Administrativa NA-101', null, 'Energia Solar/Fotovoltaica ou TermoSolar', 'trifasico', null),
  ('PE', 'Pernambuco', 'Nordeste', 'CPRH', null, null, '12.5.7 Não especificado anteriormente', 'nao_informado', null),
  ('PI', 'Piauí', 'Nordeste', 'SEMARH', null, 'Sim', 'D2-015 Sistema de Abastecimento de Energia por Baterias', 'trifasico', null),
  ('RN', 'Rio Grande do Norte', 'Nordeste', 'IDEMA', 'Resolução CONEMA 01 de 2026', 'Em elaboração', 'Sistema de Abastecimento de Energia por Baterias', 'em_elaboracao', null),
  ('SE', 'Sergipe', 'Nordeste', 'ADEMA', null, null, 'Consulta Prévia', 'em_consulta', null),
  ('GO', 'Goiás', 'Centro-Oeste', 'SEMAD', null, 'Em elaboração', 'Municipal', 'em_elaboracao', null),
  ('MT', 'Mato Grosso', 'Centro-Oeste', 'SEMA', null, 'Em consulta', 'Consulta', 'em_consulta', null),
  ('MS', 'Mato Grosso do Sul', 'Centro-Oeste', 'IMASUL', null, 'Em consulta', 'Consulta', 'em_consulta', null),
  ('ES', 'Espírito Santo', 'Sudeste', 'IEMA', 'Norma Administrativa NA-002/2023', 'Em elaboração', 'Sem enquadramento específico', 'em_elaboracao', null),
  ('MG', 'Minas Gerais', 'Sudeste', 'IEF-SEMAD', 'Deliberação Normativa nº 217/2017', 'Dispensa', 'Dispensa — Sistema de Armazenamento de Energia', 'dispensa', null),
  ('RJ', 'Rio de Janeiro', 'Sudeste', 'INEA', null, null, null, 'nao_informado', 'Documento original informa apenas o contato do órgão.'),
  ('SP', 'São Paulo', 'Sudeste', 'CETESB', null, 'Dispensa', 'Dispensa — BESS', 'dispensa', null),
  ('PR', 'Paraná', 'Sul', 'IAT', 'Decreto Estadual nº 9.541/2025', null, 'Não dispõe', 'trifasico', null),
  ('RS', 'Rio Grande do Sul', 'Sul', 'FEPAM', 'Resolução CONSEMA 372/2018', null, '3510 Subestação de Energia Elétrica', 'simplificado', 'LPI. Colunas deslocadas no documento original.'),
  ('SC', 'Santa Catarina', 'Sul', 'IMA', 'Resolução CONSEMA 250/2024', 'Sim', 'Colocalizado UFV/EOL/UTE e Stand-Alone Subestação', 'simplificado', 'LAC.'),
  ('DF', 'Distrito Federal', 'Centro-Oeste', null, null, null, null, 'nao_informado', 'UF não contemplada no levantamento LICENCIAMENTO_BESS.pdf; registrada para completar as 27 UFs federativas.');

-- ============================================================================
-- 2. Estrutura: subcritério só de triagem, preenchimento por UF, trial e ajuste manual
-- ============================================================================
do $$
declare
  c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.ahp_subcriteria'::regclass and contype = 'c'
      and (pg_get_constraintdef(oid) ~ 'score_mode' or pg_get_constraintdef(oid) ~ 'auto_source')
  loop
    execute format('alter table ahp_subcriteria drop constraint %I', c);
  end loop;
end $$;

alter table ahp_subcriteria
  add constraint ahp_subcriteria_score_mode_check check (score_mode in ('scale', 'relative_lower', 'screening')),
  add constraint ahp_subcriteria_auto_source_check check (auto_source is null or auto_source in ('ng', 'licensing')),
  add column trial boolean not null default false;

-- Chave da faixa que o preenchimento automático escolhe (rito de licenciamento).
alter table ahp_scales add column auto_key text;

-- Ajuste manual de uma nota preenchida automaticamente: quem, quando e por quê.
alter table ahp_alternative_scores
  add column override_reason text,
  add column overridden_by uuid references auth.users(id) on delete set null,
  add column overridden_by_email text,
  add column overridden_at timestamptz;

-- ============================================================================
-- 3. Modelos de projeto (Investidor e Fabricante): desdobra o licenciamento e marca o trial
-- ============================================================================
do $$
declare
  m record;
  s_stage uuid; s_rule uuid; s_area uuid; s_iphan uuid; s_new uuid;
  v_stage_weight numeric;
begin
  for m in select id, variant_label from ahp_models where category = 'projeto' loop
    select s.id into s_stage from ahp_subcriteria s join ahp_pillars p on p.id = s.pillar_id
      where p.model_id = m.id and s.name = 'Estágio do licenciamento (BESS + linha)';
    select s.id into s_rule from ahp_subcriteria s join ahp_pillars p on p.id = s.pillar_id
      where p.model_id = m.id and s.name = 'Regra estadual de licenciamento';
    select s.id into s_area from ahp_subcriteria s join ahp_pillars p on p.id = s.pillar_id
      where p.model_id = m.id and s.name = 'Área de implantação';
    select s.id into s_iphan from ahp_subcriteria s join ahp_pillars p on p.id = s.pillar_id
      where p.model_id = m.id and s.name = 'Licenciamento IPHAN';

    if s_stage is null or s_rule is null or s_area is null or s_iphan is null then
      raise exception 'modelo % sem os subcritérios de licenciamento esperados', m.id;
    end if;

    -- Peso do Estágio: 45 -> 35 (Investidor) e 80 -> 85 (Fabricante), para os totais seguirem em 1000.
    v_stage_weight := case when m.variant_label = 'Fabricante' then 85 else 35 end;
    update ahp_subcriteria set weight_pct = v_stage_weight where id = s_stage;

    -- Triagem: peso 15, não pontua, não tem faixas. Insumo do parâmetro de complexidade.
    delete from ahp_alternative_scores where subcriterion_id = s_rule;
    delete from ahp_scales where subcriterion_id = s_rule;
    update ahp_subcriteria
       set name = 'Regra de licenciamento estadual (triagem)', weight_pct = 15, score_mode = 'screening',
           auto_source = 'licensing', trial = true, sort_order = 1
     where id = s_rule;

    -- Complexidade do rito: peso 20, pontua; preenchida pela UF do município do projeto.
    update ahp_subcriteria set sort_order = 3 where id = s_area;
    update ahp_subcriteria set sort_order = 4 where id = s_iphan;
    insert into ahp_subcriteria (pillar_id, name, weight_pct, sort_order, score_mode, auto_source, trial)
      select pillar_id, 'Complexidade do rito de licenciamento', 20, 2, 'scale', 'licensing', true
      from ahp_subcriteria where id = s_rule
      returning id into s_new;
    insert into ahp_scales (subcriterion_id, description, fulfillment_pct, sort_order, auto_key) values
      (s_new, 'Dispensa', 100, 0, 'dispensa'),
      (s_new, 'Simplificado', 90, 1, 'simplificado'),
      (s_new, 'Trifásico', 50, 2, 'trifasico'),
      (s_new, 'Em elaboração', 30, 3, 'em_elaboracao'),
      (s_new, 'Em consulta', 20, 4, 'em_consulta'),
      (s_new, 'Não informado', 0, 5, 'nao_informado');

    -- Área de implantação: nova redação da v3.
    update ahp_subcriteria set name = 'Área de implantação (desbastada)' where id = s_area;
    update ahp_scales set description = 'Área disponível para o BESS + linha' where subcriterion_id = s_area and fulfillment_pct = 100;
    update ahp_scales set description = 'Área não disponível' where subcriterion_id = s_area and fulfillment_pct = 0;

    -- Parâmetros da versão trial (roxos na planilha).
    update ahp_subcriteria set trial = true
     where pillar_id in (select id from ahp_pillars where model_id = m.id)
       and name in (
         'Índice MUST/DispPot', 'Impedância de projeto', 'Restrição tipo B no barramento',
         'Histórico de eventos / descargas atmosféricas (Ng)'
       );
  end loop;
end $$;

-- ============================================================================
-- 4. Execução na versão trial: rodadas ilimitadas, sem consumir crédito
--    Trial = sem plano vigente e sem saldo de créditos.
-- ============================================================================
create or replace function public.create_ahp_run(
  p_model_id uuid,
  p_consistency_ratio numeric,
  p_lambda_max numeric,
  p_pillar_comparisons jsonb,
  p_pillar_weights jsonb,
  p_results jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_run_id uuid;
  v_tx_id uuid;
  v_item jsonb;
  v_alt_count int;
  v_results_count int;
  v_distinct_count int;
  v_matched_count int;
  v_trial boolean;
begin
  if v_user is null then
    raise exception 'not_authenticated';
  end if;

  if not exists (select 1 from ahp_models m where m.id = p_model_id and m.status = 'active') then
    raise exception 'model_not_found';
  end if;

  if p_consistency_ratio is null or p_consistency_ratio != p_consistency_ratio
     or p_consistency_ratio < 0 or p_consistency_ratio > 10 then
    raise exception 'invalid_consistency_ratio';
  end if;
  if p_lambda_max is null or p_lambda_max != p_lambda_max
     or p_lambda_max < 0 or p_lambda_max > 1000 then
    raise exception 'invalid_lambda_max';
  end if;

  if p_results is null or jsonb_typeof(p_results) != 'array' then
    raise exception 'invalid_results';
  end if;

  select count(*) into v_alt_count from ahp_alternatives where model_id = p_model_id and user_id = v_user;
  select jsonb_array_length(p_results) into v_results_count;
  select count(distinct (item ->> 'alternative_id'))
    into v_distinct_count
    from jsonb_array_elements(p_results) as item;

  if v_results_count = 0 or v_results_count > v_alt_count or v_distinct_count != v_results_count then
    raise exception 'invalid_results_count';
  end if;

  select count(*)
    into v_matched_count
    from jsonb_array_elements(p_results) as item
    join ahp_alternatives a
      on a.id = (item ->> 'alternative_id')::uuid and a.model_id = p_model_id and a.user_id = v_user;
  if v_matched_count != v_results_count then
    raise exception 'alternative_not_in_model';
  end if;

  v_trial := (public.current_user_plan(v_user)).id is null
             and coalesce((select balance from user_credit_balance where user_id = v_user), 0) <= 0;

  insert into ahp_runs (
    user_id, model_id, run_by, consistency_ratio, lambda_max, pillar_comparisons, pillar_weights
  )
  values (
    v_user, p_model_id, v_user, p_consistency_ratio, p_lambda_max, p_pillar_comparisons, p_pillar_weights
  )
  returning id into v_run_id;

  for v_item in select * from jsonb_array_elements(p_results)
  loop
    insert into ahp_run_results (
      run_id, alternative_id, final_score, rank, pillar_scores, pillar_scores_radar, eliminated, eliminated_reason
    )
    values (
      v_run_id,
      (v_item ->> 'alternative_id')::uuid,
      (v_item ->> 'final_score')::numeric,
      (v_item ->> 'rank')::int,
      v_item -> 'pillar_scores',
      v_item -> 'pillar_scores_radar',
      coalesce((v_item ->> 'eliminated')::boolean, false),
      v_item ->> 'eliminated_reason'
    );
  end loop;

  if not v_trial then
    insert into credit_transactions (user_id, type, amount, related_run_id, description, created_by)
    values (v_user, 'consumption', -1, v_run_id, 'Execução de matriz AHP', v_user)
    returning id into v_tx_id;

    update ahp_runs set credit_transaction_id = v_tx_id where id = v_run_id;
  end if;

  return v_run_id;
end;
$$;
revoke all on function public.create_ahp_run(uuid, numeric, numeric, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_ahp_run(uuid, numeric, numeric, jsonb, jsonb, jsonb) to authenticated, service_role;
