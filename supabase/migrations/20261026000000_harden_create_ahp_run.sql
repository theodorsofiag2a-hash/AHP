-- ============================================================================
-- Correção de segurança (auditoria 2026-10-26, docs/SECURITY_AUDIT.md, achados S1/S3):
-- create_ahp_run() confiava demais no chamador. Qualquer organization member podia:
--   (a) apontar p_model_id para um modelo de OUTRA organização (o resultado gravado
--       ficava ligado à org do chamador, mas lendo dados de um modelo alheio);
--   (b) enviar alternative_id de alternativas que não pertencem ao modelo;
--   (c) enviar p_results com qualquer quantidade de linhas (amplificação: 1 crédito
--       pagava por milhares de linhas gravadas em ahp_run_results);
--   (d) enviar consistency_ratio/lambda_max não numéricos (NaN é um numeric válido em
--       Postgres) ou fora de qualquer faixa plausível.
-- Confirmado dinamicamente em ambiente local descartável antes desta correção: uma
-- execução foi gravada apontando para o modelo de outra organização, e um array de
-- 3000 resultados forjados foi aceito por 1 crédito só.
--
-- Esta migration adiciona as validações que faltavam. Não resolve o problema de fundo
-- (o cliente ainda decide o ranking/CR; o ideal é recalcular no servidor a partir de
-- ahp_alternative_scores) — isso fica registrado no roadmap do relatório.
-- ============================================================================

create or replace function public.create_ahp_run(
  p_organization_id uuid,
  p_model_id uuid,
  p_consistency_ratio numeric,
  p_lambda_max numeric,
  p_pillar_comparisons jsonb,
  p_pillar_weights jsonb,
  p_results jsonb -- array de {alternative_id, final_score, rank, pillar_scores, pillar_scores_radar}
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

  -- (a) o modelo precisa pertencer à organização do chamador.
  if not exists (
    select 1 from ahp_models m
    where m.id = p_model_id and m.organization_id = p_organization_id
  ) then
    raise exception 'model_not_in_organization';
  end if;

  -- (d) rejeita NaN/Infinity/NULL/fora de faixa plausível antes de gravar.
  -- (NaN é um valor numeric válido em Postgres; "x != x" só é verdadeiro para NaN.)
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

  -- (c) nunca mais linhas que alternativas reais do modelo, e sem repetição de alternativa.
  if v_results_count = 0 or v_results_count > v_alt_count or v_distinct_count != v_results_count then
    raise exception 'invalid_results_count';
  end if;

  -- (b) cada alternative_id precisa pertencer a este modelo.
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

-- ============================================================================
-- Endurecimento adicional (achado S13 do relatório), restrito ao que não arrisca
-- quebrar RLS: is_org_member() é chamada dentro de praticamente toda policy do schema
-- (para anon e authenticated), então seus GRANTs ficam intocados de propósito — revogar
-- EXECUTE ali quebraria a avaliação das policies para todo mundo.
--
-- set_updated_at() não tinha search_path fixo (único item real do lint
-- function_search_path_mutable; os demais já tinham "search_path=public").
alter function public.set_updated_at() set search_path = public;

-- Postgres concede EXECUTE a PUBLIC por padrão na criação da função; um REVOKE de um
-- papel específico (ex. "from anon") não remove esse acesso herdado via PUBLIC. É preciso
-- revogar de PUBLIC e then conceder de volta só a quem precisa.
--
-- handle_new_user() e credit_transactions_before_insert() só são chamadas pelo próprio
-- Postgres via trigger (after insert on auth.users / before insert on credit_transactions);
-- a invocação por trigger não depende do chamador ter EXECUTE na função, então revogar de
-- todo mundo (sem conceder de volta a ninguém) fecha a exposição via /rest/v1/rpc/* sem
-- afetar os triggers — confirmado em ambiente de teste (signup continuou funcionando).
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.credit_transactions_before_insert() from public;

-- create_ahp_run() e generate_org_slug() só devem ser chamadas por usuários autenticados
-- (a própria lógica interna já barra anon via is_org_member/auth.uid nulo, mas o ideal é
-- nem deixar a chamada entrar na função). service_role mantém acesso para uso administrativo.
revoke execute on function public.create_ahp_run(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb) from public;
grant execute on function public.create_ahp_run(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb) to authenticated, service_role;

revoke execute on function public.generate_org_slug(text) from public;
grant execute on function public.generate_org_slug(text) to authenticated, service_role;
