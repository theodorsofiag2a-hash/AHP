-- Fim do conceito de organização.
--  * Os modelos (Fornecedor, BESS Investidor, BESS Fabricante) viram únicos e globais: qualquer
--    conta logada lê, ninguém escreve pela API (a estrutura só muda por migration/service role).
--  * Alternativas, execuções, créditos, planos, pedidos, assinaturas e pagamentos passam a ser
--    do usuário (user_id) em vez da organização. O dono de cada organização herda os registros.
--  * Apaga todas as alternativas/avaliações/execuções e todos os modelos duplicados.
--  * Remove organizations, organization_members e as funções is_org_*.

-- ============================================================================
-- 0. Mapa organização -> dono (usado para migrar a titularidade dos registros)
-- ============================================================================
create temp table _owner as
select distinct on (organization_id) organization_id, user_id
from organization_members
order by organization_id, (role = 'owner') desc, joined_at nulls last;

-- ============================================================================
-- 1. Remove todas as policies antigas (dependem de is_org_member/is_org_admin)
-- ============================================================================
drop policy if exists ahp_alternative_scores_all on ahp_alternative_scores;
drop policy if exists ahp_alternative_values_all on ahp_alternative_values;
drop policy if exists ahp_alternatives_all on ahp_alternatives;
drop policy if exists ahp_insights_select on ahp_insights;
drop policy if exists ahp_models_select on ahp_models;
drop policy if exists ahp_pillars_select on ahp_pillars;
drop policy if exists ahp_run_results_select on ahp_run_results;
drop policy if exists ahp_runs_select on ahp_runs;
drop policy if exists ahp_scales_select on ahp_scales;
drop policy if exists ahp_subcriteria_select on ahp_subcriteria;
drop policy if exists asaas_payments_select on asaas_payments;
drop policy if exists billing_profiles_select on billing_profiles;
drop policy if exists credit_transactions_select on credit_transactions;
drop policy if exists organization_credit_balance_select on organization_credit_balance;
drop policy if exists organization_members_select on organization_members;
drop policy if exists organization_plans_select on organization_plans;
drop policy if exists organizations_select on organizations;
drop policy if exists organizations_update on organizations;
drop policy if exists plan_orders_select on plan_orders;
drop policy if exists plan_subscriptions_select on plan_subscriptions;

-- ============================================================================
-- 2. Dados: fica só a versão atual dos modelos; todo o resto é apagado
-- ============================================================================
delete from ahp_runs;          -- cascata: resultados e insights
delete from ahp_alternatives;  -- cascata: notas e valores

do $$
declare
  v_keep int;
begin
  select count(*) into v_keep
  from ahp_models m join organizations o on o.id = m.organization_id
  where o.slug = 'theodorsofiag2a' and m.status = 'active';
  if v_keep <> 3 then
    raise exception 'esperava 3 modelos ativos para manter, achei %', v_keep;
  end if;

  delete from ahp_models m
  where not exists (
    select 1 from organizations o
    where o.id = m.organization_id and o.slug = 'theodorsofiag2a' and m.status = 'active'
  );
end $$;

-- ============================================================================
-- 3. Modelos globais
-- ============================================================================
alter table ahp_models drop constraint ahp_models_organization_id_fkey;
alter table ahp_models drop constraint ahp_models_organization_id_slug_key;
drop index if exists idx_ahp_models_org;
alter table ahp_models drop column organization_id;
alter table ahp_models add constraint ahp_models_slug_key unique (slug);

-- ============================================================================
-- 4. Alternativas passam a ter dono
-- ============================================================================
alter table ahp_alternatives
  add column user_id uuid not null default auth.uid() references auth.users(id) on delete cascade;
alter table ahp_alternatives drop constraint ahp_alternatives_model_id_name_key;
alter table ahp_alternatives add constraint ahp_alternatives_model_id_user_id_name_key unique (model_id, user_id, name);
create index idx_ahp_alternatives_user on ahp_alternatives (user_id);

-- ============================================================================
-- 5. Renomeia tabelas/colunas de organização para usuário e migra a titularidade
-- ============================================================================
alter table organization_credit_balance rename to user_credit_balance;
alter table organization_plans rename to user_plans;
alter table plan_orders rename column organization_plan_id to user_plan_id;
alter table asaas_payments rename column organization_plan_id to user_plan_id;

do $$
declare
  t text;
  fk text;
begin
  foreach t in array array[
    'credit_transactions', 'ahp_runs', 'ahp_insights', 'billing_profiles', 'user_credit_balance',
    'user_plans', 'plan_orders', 'plan_subscriptions', 'asaas_payments'
  ] loop
    for fk in
      select conname from pg_constraint
      where conrelid = format('public.%I', t)::regclass and contype = 'f'
        and confrelid = 'public.organizations'::regclass
    loop
      execute format('alter table %I drop constraint %I', t, fk);
    end loop;

    execute format(
      'update %I x set organization_id = o.user_id from _owner o where o.organization_id = x.organization_id', t);
    execute format('alter table %I rename column organization_id to user_id', t);
    execute format(
      'alter table %I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      t, t || '_user_id_fkey');
  end loop;
end $$;

-- ============================================================================
-- 6. Funções: remove as de organização e recria as de cobrança por usuário
-- ============================================================================
drop function if exists public.create_ahp_run(uuid, uuid, numeric, numeric, jsonb, jsonb, jsonb);
drop function if exists public.current_org_plan(uuid);
drop function if exists public.renew_org_plan(uuid, uuid, text, timestamptz, text);

create or replace function public.current_user_plan(p_user_id uuid)
returns user_plans
language sql
stable
security definer
set search_path = public
as $$
  select *
  from user_plans
  where user_id = p_user_id
    and status <> 'pending'
  order by created_at desc
  limit 1
$$;
revoke all on function public.current_user_plan(uuid) from public, anon, authenticated;
grant execute on function public.current_user_plan(uuid) to service_role;

create or replace function public.credit_transactions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  insert into user_credit_balance (user_id, balance)
  values (new.user_id, 0)
  on conflict (user_id) do nothing;

  select balance into v_balance
  from user_credit_balance
  where user_id = new.user_id
  for update;

  v_balance := v_balance + new.amount;

  if v_balance < 0 then
    raise exception 'insufficient_credits';
  end if;

  new.balance_after := v_balance;

  update user_credit_balance
  set balance = v_balance, updated_at = now()
  where user_id = new.user_id;

  return new;
end;
$$;

create or replace function public.skip_credit_consumption_under_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'consumption' and (public.current_user_plan(new.user_id)).id is not null then
    return null;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_plan_alternatives_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan user_plans;
  v_count int;
begin
  if new.user_id is null then
    return new;
  end if;

  v_plan := public.current_user_plan(new.user_id);
  if v_plan.id is null then
    return new;
  end if;

  perform 1 from user_plans where id = v_plan.id for update;
  v_plan := public.current_user_plan(new.user_id);

  if not public.plan_is_usable(v_plan) then
    raise exception 'plan_not_active';
  end if;

  select count(*) into v_count from ahp_alternatives where user_id = new.user_id;

  if v_count >= v_plan.max_alternatives then
    raise exception 'plan_alternatives_limit';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_plan_runs_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan user_plans;
  v_used int;
begin
  v_plan := public.current_user_plan(new.user_id);
  if v_plan.id is null then
    return new;
  end if;

  perform 1 from user_plans where id = v_plan.id for update;
  v_plan := public.current_user_plan(new.user_id);

  if not public.plan_is_usable(v_plan) then
    raise exception 'plan_not_active';
  end if;

  if v_plan.runs_limit is not null then
    select count(*) into v_used
    from ahp_runs
    where user_id = new.user_id
      and created_at >= v_plan.period_started_at;

    if v_used >= v_plan.runs_limit then
      raise exception 'plan_runs_exhausted';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_credit_balance (user_id, balance)
  values (new.id, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function public.renew_user_plan(p_user uuid, p_plan_id uuid, p_environment text, p_now timestamptz, p_subscription text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan plans; v_cur user_plans; v_base timestamptz; v_id uuid;
begin
  select * into v_plan from plans where id = p_plan_id;
  select * into v_cur from user_plans where user_id = p_user and status <> 'pending' order by created_at desc limit 1 for update;
  if found and v_cur.status in ('active', 'past_due') then
    v_base := greatest(v_cur.valid_until, p_now);
    update user_plans
       set plan_id = v_plan.id, max_alternatives = v_plan.max_alternatives, runs_limit = v_plan.runs_limit,
           period_started_at = v_base, valid_until = v_base + make_interval(months => v_plan.validity_months),
           status = 'active', past_due_since = null,
           auto_renew = case when p_subscription is not null then true else auto_renew end,
           asaas_subscription_id = coalesce(p_subscription, asaas_subscription_id)
     where id = v_cur.id returning id into v_id;
    return v_id;
  end if;
  if found and v_cur.status = 'suspended' then return null; end if;
  begin
    insert into user_plans (user_id, plan_id, status, starts_at, period_started_at, valid_until, max_alternatives, runs_limit, auto_renew, asaas_subscription_id, environment)
    values (p_user, v_plan.id, 'active', p_now, p_now, p_now + make_interval(months => v_plan.validity_months), v_plan.max_alternatives, v_plan.runs_limit, p_subscription is not null, p_subscription, p_environment)
    returning id into v_id;
  exception when unique_violation then raise exception 'plan_already_open';
  end;
  return v_id;
end;
$$;
revoke all on function public.renew_user_plan(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.renew_user_plan(uuid, uuid, text, timestamptz, text) to service_role;

create or replace function public.apply_asaas_payment(p_asaas_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay asaas_payments; v_order plan_orders; v_has_order boolean := false; v_order_activated boolean := false;
  v_plan plans; v_old_plan plans; v_existing user_plans; v_new_wins boolean; v_contract user_plans;
  v_contract_id uuid; v_sub plan_subscriptions; v_ren_order uuid; v_now timestamptz := now(); v_result text;
begin
  select * into v_pay from asaas_payments where asaas_payment_id = p_asaas_payment_id for update;
  if not found then return 'skipped:payment_not_found'; end if;
  if v_pay.order_id is null and v_pay.user_plan_id is null and v_pay.user_id is null then return 'skipped:no_order'; end if;

  if v_pay.status in ('REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'OVERDUE') then
    v_contract_id := coalesce(
      case when v_pay.asaas_subscription_id is not null and v_pay.user_id is not null then
        (select c.id from user_plans c where c.user_id = v_pay.user_id and c.status <> 'pending' order by c.created_at desc limit 1)
      end,
      v_pay.user_plan_id,
      (select o.user_plan_id from plan_orders o where o.id = v_pay.order_id));
    if v_contract_id is null then return 'skipped:no_contract'; end if;
    if v_pay.status = 'OVERDUE' then
      update user_plans set status = 'past_due', past_due_since = coalesce(past_due_since, v_now) where id = v_contract_id and status = 'active';
      return case when found then 'past_due' else 'skipped:contract_not_active' end;
    end if;
    update user_plans set status = 'suspended' where id = v_contract_id and status in ('active', 'past_due');
    return case when found then 'suspended' else 'skipped:contract_not_open' end;
  end if;

  if v_pay.status not in ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH') then return 'skipped:status_' || v_pay.status; end if;

  if v_pay.order_id is not null then
    select * into v_order from plan_orders where id = v_pay.order_id for update;
    if not found then return 'skipped:order_not_found'; end if;
    v_has_order := true;
    v_order_activated := v_order.user_plan_id is not null;
    if v_pay.user_id is distinct from v_order.user_id then raise exception 'payment_user_mismatch'; end if;
    if v_pay.environment <> v_order.environment then return 'skipped:environment_mismatch'; end if;
  elsif v_pay.asaas_subscription_id is null then
    return 'skipped:no_order';
  end if;

  if v_pay.applied_at is not null then
    v_contract_id := v_pay.user_plan_id;
    v_result := 'already_applied';

  elsif v_pay.asaas_subscription_id is not null and (not v_has_order or v_order_activated) then
    select * into v_sub from plan_subscriptions where asaas_subscription_id = v_pay.asaas_subscription_id;
    if not found then return 'skipped:subscription_unknown'; end if;
    if v_pay.user_id is not null and v_pay.user_id <> v_sub.user_id then raise exception 'payment_user_mismatch'; end if;
    if v_pay.environment <> v_sub.environment then return 'skipped:environment_mismatch'; end if;
    if v_pay.value_cents is null or v_pay.value_cents <= 0 then raise exception 'payment_value_mismatch'; end if;

    v_contract_id := public.renew_user_plan(v_sub.user_id, v_sub.plan_id, v_sub.environment, v_now, v_sub.asaas_subscription_id);
    if v_contract_id is null then return 'skipped:contract_suspended'; end if;

    insert into plan_orders (user_id, plan_id, user_plan_id, kind, payment_method, installment_count, amount_cents, auto_renew, status, environment)
    values (v_sub.user_id, v_sub.plan_id, v_contract_id, 'renewal', 'CREDIT_CARD', 1, v_pay.value_cents, true, 'paid', v_sub.environment)
    returning id into v_ren_order;

    update asaas_payments set order_id = v_ren_order, user_id = v_sub.user_id, user_plan_id = v_contract_id, applied_at = v_now where id = v_pay.id;
    v_result := 'renewed';

  elsif not v_order_activated then
    if v_pay.value_cents is null
       or v_pay.value_cents < (v_order.amount_cents / v_order.installment_count) - 1
       or v_pay.value_cents > v_order.amount_cents + 1 then
      raise exception 'payment_value_mismatch';
    end if;
    select * into v_plan from plans where id = v_order.plan_id;

    if v_order.kind = 'renewal' then
      v_contract_id := public.renew_user_plan(v_order.user_id, v_order.plan_id, v_order.environment, v_now, null);
      if v_contract_id is null then return 'skipped:contract_suspended'; end if;
      update plan_orders set user_plan_id = v_contract_id, status = 'paid' where id = v_order.id;
      v_result := 'renewed';
    else
      select * into v_existing from user_plans where user_id = v_order.user_id and status = 'active' and valid_until > v_now for update;
      if found then
        select * into v_old_plan from plans where id = v_existing.plan_id;
        v_new_wins := v_plan.price_cents > v_old_plan.price_cents;
        update user_plans
           set plan_id = case when v_new_wins then v_plan.id else plan_id end,
               max_alternatives = max_alternatives + v_plan.max_alternatives,
               runs_limit = case when runs_limit is null or v_plan.runs_limit is null then null else runs_limit + v_plan.runs_limit end,
               valid_until = case when v_new_wins then v_now + make_interval(months => v_plan.validity_months) else valid_until end
         where id = v_existing.id returning * into v_contract;
        update plan_orders set user_plan_id = v_contract.id, status = 'paid' where id = v_order.id;
        v_contract_id := v_contract.id;
        v_result := 'merged';
      else
        update user_plans set status = case when valid_until <= v_now then 'expired' else 'canceled' end
         where user_id = v_order.user_id and status in ('active', 'past_due', 'suspended');
        begin
          insert into user_plans (user_id, plan_id, status, starts_at, period_started_at, valid_until, max_alternatives, runs_limit, auto_renew, asaas_installment_id, asaas_subscription_id, environment)
          values (v_order.user_id, v_order.plan_id, 'active', v_now, v_now, v_now + make_interval(months => v_plan.validity_months), v_plan.max_alternatives, v_plan.runs_limit, v_order.auto_renew, v_pay.asaas_installment_id, v_pay.asaas_subscription_id, v_order.environment)
          returning * into v_contract;
        exception when unique_violation then raise exception 'plan_already_open';
        end;
        update plan_orders set user_plan_id = v_contract.id, status = 'paid' where id = v_order.id;
        v_contract_id := v_contract.id;
        v_result := 'activated';
      end if;
    end if;

    if v_pay.asaas_subscription_id is not null and v_order.auto_renew then
      insert into plan_subscriptions (user_id, plan_id, origin_order_id, asaas_subscription_id, environment)
      values (v_order.user_id, v_order.plan_id, v_order.id, v_pay.asaas_subscription_id, v_order.environment)
      on conflict (asaas_subscription_id) do nothing;
      update user_plans set auto_renew = true, asaas_subscription_id = v_pay.asaas_subscription_id where id = v_contract_id;
    end if;

    update asaas_payments set user_plan_id = v_contract_id, applied_at = v_now where id = v_pay.id;
  else
    v_contract_id := v_order.user_plan_id;
    v_result := 'attached';
    update asaas_payments set user_plan_id = v_contract_id, applied_at = v_now where id = v_pay.id;
  end if;

  update user_plans c set status = 'active', past_due_since = null
   where c.id = v_contract_id and c.status = 'past_due'
     and not exists (select 1 from asaas_payments p where p.user_plan_id = c.id and p.status = 'OVERDUE');
  return v_result;
end;
$$;
revoke all on function public.apply_asaas_payment(text) from public, anon, authenticated;
grant execute on function public.apply_asaas_payment(text) to service_role;

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

  insert into credit_transactions (user_id, type, amount, related_run_id, description, created_by)
  values (v_user, 'consumption', -1, v_run_id, 'Execução de matriz AHP', v_user)
  returning id into v_tx_id;

  update ahp_runs set credit_transaction_id = v_tx_id where id = v_run_id;

  return v_run_id;
end;
$$;
revoke all on function public.create_ahp_run(uuid, numeric, numeric, jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.create_ahp_run(uuid, numeric, numeric, jsonb, jsonb, jsonb) to authenticated, service_role;

-- ============================================================================
-- 7. Remove o conceito de organização
-- ============================================================================
drop table organization_members;
drop table organizations;
drop table _owner;
drop function if exists public.is_org_member(uuid);
drop function if exists public.is_org_admin(uuid);
drop function if exists public.generate_org_slug(text);

-- ============================================================================
-- 8. Policies novas
-- ============================================================================
-- Modelos: leitura para qualquer conta logada; nenhuma policy de escrita.
create policy ahp_models_select on ahp_models for select to authenticated using (true);
create policy ahp_pillars_select on ahp_pillars for select to authenticated using (true);
create policy ahp_subcriteria_select on ahp_subcriteria for select to authenticated using (true);
create policy ahp_scales_select on ahp_scales for select to authenticated using (true);

-- Alternativas e avaliações: só do próprio usuário.
create policy ahp_alternatives_all on ahp_alternatives
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (select 1 from ahp_models m where m.id = ahp_alternatives.model_id and m.status = 'active')
  );

create policy ahp_alternative_scores_all on ahp_alternative_scores
  for all to authenticated
  using (
    exists (select 1 from ahp_alternatives a where a.id = ahp_alternative_scores.alternative_id and a.user_id = auth.uid())
  )
  with check (
    exists (
      select 1
      from ahp_alternatives a
      join ahp_subcriteria s
        on s.id = ahp_alternative_scores.subcriterion_id
       and s.pillar_id in (select p.id from ahp_pillars p where p.model_id = a.model_id)
      join ahp_scales sc
        on sc.id = ahp_alternative_scores.scale_id and sc.subcriterion_id = s.id
      where a.id = ahp_alternative_scores.alternative_id and a.user_id = auth.uid()
    )
  );

create policy ahp_alternative_values_all on ahp_alternative_values
  for all to authenticated
  using (
    exists (select 1 from ahp_alternatives a where a.id = ahp_alternative_values.alternative_id and a.user_id = auth.uid())
  )
  with check (
    exists (
      select 1
      from ahp_alternatives a
      join ahp_subcriteria s
        on s.id = ahp_alternative_values.subcriterion_id
       and s.score_mode = 'relative_lower'
       and s.pillar_id in (select p.id from ahp_pillars p where p.model_id = a.model_id)
      where a.id = ahp_alternative_values.alternative_id and a.user_id = auth.uid()
    )
  );

-- Execuções, créditos e cobrança: cada usuário lê só os seus.
create policy ahp_runs_select on ahp_runs for select to authenticated using (user_id = auth.uid());
create policy ahp_run_results_select on ahp_run_results for select to authenticated
  using (exists (select 1 from ahp_runs r where r.id = ahp_run_results.run_id and r.user_id = auth.uid()));
create policy ahp_insights_select on ahp_insights for select to authenticated using (user_id = auth.uid());
create policy credit_transactions_select on credit_transactions for select to authenticated using (user_id = auth.uid());
create policy user_credit_balance_select on user_credit_balance for select to authenticated using (user_id = auth.uid());
create policy user_plans_select on user_plans for select to authenticated using (user_id = auth.uid());
create policy plan_orders_select on plan_orders for select to authenticated using (user_id = auth.uid());
create policy plan_subscriptions_select on plan_subscriptions for select to authenticated using (user_id = auth.uid());
create policy asaas_payments_select on asaas_payments for select to authenticated
  using (user_id is not null and user_id = auth.uid());
create policy billing_profiles_select on billing_profiles for select to authenticated using (user_id = auth.uid());
