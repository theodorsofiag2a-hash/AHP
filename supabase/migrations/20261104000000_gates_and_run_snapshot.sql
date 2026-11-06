-- Filtros eliminatórios (go/no-go) por alternativa e "foto" dos dados de cada execução.
--
-- Filtros (Premissário R1 / seção 11 do relatório): true = atende, false = não atende,
-- null = pendente. Quem não atende a qualquer filtro fica fora do ranking.
-- Foto (inputs_snapshot): o que foi usado na rodada (notas, escalas, filtros, conexão),
-- para o relatório reproduzir a execução mesmo que a ficha seja editada depois.

alter table public.ahp_alternatives
  add column if not exists gate_rte boolean,
  add column if not exists gate_deadline boolean,
  add column if not exists gate_auction boolean,
  add column if not exists gate_technical boolean;

alter table public.ahp_runs
  add column if not exists inputs_snapshot jsonb;

-- Nova assinatura com p_inputs_snapshot (opcional): chamadas antigas de 7 parâmetros continuam válidas.
drop function if exists public.create_ahp_run(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb);

create or replace function public.create_ahp_run(
  p_organization_id uuid,
  p_model_id uuid,
  p_consistency_ratio numeric,
  p_lambda_max numeric,
  p_pillar_comparisons jsonb,
  p_pillar_weights jsonb,
  p_results jsonb, -- array de {alternative_id, final_score, rank, pillar_scores, pillar_scores_radar}
  p_inputs_snapshot jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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

  -- A foto é opcional, mas se vier precisa ser um objeto e ter tamanho razoável (1 crédito não paga megabytes).
  if p_inputs_snapshot is not null and (
    jsonb_typeof(p_inputs_snapshot) != 'object' or pg_column_size(p_inputs_snapshot) > 2000000
  ) then
    raise exception 'invalid_inputs_snapshot';
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
    organization_id, model_id, run_by, consistency_ratio, lambda_max, pillar_comparisons, pillar_weights, inputs_snapshot
  )
  values (
    p_organization_id, p_model_id, auth.uid(), p_consistency_ratio, p_lambda_max, p_pillar_comparisons, p_pillar_weights,
    p_inputs_snapshot
  )
  returning id into v_run_id;

  for v_item in select * from jsonb_array_elements(p_results)
  loop
    insert into ahp_run_results (run_id, alternative_id, final_score, rank, pillar_scores, pillar_scores_radar)
    values (
      v_run_id,
      (v_item ->> 'alternative_id')::uuid,
      (v_item ->> 'final_score')::numeric,
      (v_item ->> 'rank')::int,
      v_item -> 'pillar_scores',
      v_item -> 'pillar_scores_radar'
    );
  end loop;

  insert into credit_transactions (organization_id, type, amount, related_run_id, description, created_by)
  values (p_organization_id, 'consumption', -1, v_run_id, 'Execução de matriz AHP', auth.uid())
  returning id into v_tx_id;

  update ahp_runs set credit_transaction_id = v_tx_id where id = v_run_id;

  return v_run_id;
end;
$$;

-- Postgres/Supabase concedem EXECUTE a anon/authenticated por default privileges: revoga
-- explicitamente de quem não deve chamar (REVOKE FROM PUBLIC sozinho não basta; ver S13).
revoke execute on function public.create_ahp_run(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_ahp_run(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb, jsonb) to authenticated, service_role;
