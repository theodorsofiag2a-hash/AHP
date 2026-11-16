-- ============================================================================
-- Critério eliminatório (ex.: restrição tipo B no barramento — Parametros_Consolidado v2).
--
-- Uma faixa (ahp_scales) pode ser marcada como eliminatória. Ao rodar a análise, o projeto que
-- tiver uma faixa eliminatória escolhida sai do ranking (e da comparação relativa da carteira)
-- e é gravado como "eliminado", com o motivo. A estrutura do modelo segue gravável só por
-- service_role; o app só lê a marca.
-- ============================================================================

alter table ahp_scales
  add column eliminates boolean not null default false;

alter table ahp_run_results
  add column eliminated boolean not null default false,
  add column eliminated_reason text;

alter table ahp_run_results alter column rank drop not null;
alter table ahp_run_results
  add constraint ahp_run_results_rank_chk check (eliminated or rank is not null);

-- Mesma função de 20261026000000_harden_create_ahp_run, aceitando projetos eliminados nos
-- resultados (rank nulo, eliminated = true). Assinatura e permissões não mudam.
create or replace function public.create_ahp_run(
  p_organization_id uuid,
  p_model_id uuid,
  p_consistency_ratio numeric,
  p_lambda_max numeric,
  p_pillar_comparisons jsonb,
  p_pillar_weights jsonb,
  p_results jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_run_id uuid;
  v_tx_id uuid;
  v_item jsonb;
  v_alt_count int;
  v_results_count int;
  v_distinct_count int;
  v_matched_count int;
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not_org_member';
  end if;

  if not exists (
    select 1 from ahp_models m
    where m.id = p_model_id and m.organization_id = p_organization_id
  ) then
    raise exception 'model_not_in_organization';
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

  select count(*) into v_alt_count from ahp_alternatives where model_id = p_model_id;
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
      on a.id = (item ->> 'alternative_id')::uuid and a.model_id = p_model_id;
  if v_matched_count != v_results_count then
    raise exception 'alternative_not_in_model';
  end if;

  insert into ahp_runs (
    organization_id, model_id, run_by, consistency_ratio, lambda_max, pillar_comparisons, pillar_weights
  )
  values (
    p_organization_id, p_model_id, auth.uid(), p_consistency_ratio, p_lambda_max, p_pillar_comparisons, p_pillar_weights
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

  insert into credit_transactions (organization_id, type, amount, related_run_id, description, created_by)
  values (p_organization_id, 'consumption', -1, v_run_id, 'Execução de matriz AHP', auth.uid())
  returning id into v_tx_id;

  update ahp_runs set credit_transaction_id = v_tx_id where id = v_run_id;

  return v_run_id;
end;
$function$;
