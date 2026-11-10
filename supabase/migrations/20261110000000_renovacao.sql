-- ============================================================================
-- Etapa 8: renovação do plano.
--
--  1. plan_subscriptions: assinaturas de renovação automática (cartão) do Asaas. Cada uma sabe QUAL plano
--     renova (o plano do pedido que a criou), mesmo depois de planos somados (organization_plans.plan_id é o
--     maior plano). Só o servidor escreve.
--  2. plan_is_usable: com renovação automática ligada, a carência de 10 dias também vale depois do
--     vencimento (cobrança da renovação recusada ou atrasada). Sem renovação automática, vence na data.
--  3. renew_org_plan: reinicia o plano (não soma): 6 meses a partir do vencimento, contagem de simulações
--     zerada, limites do plano renovado.
--  4. apply_asaas_payment: trata cobranças de renovação (por assinatura ou por novo checkout de renovação),
--     atraso e estorno de cobranças de assinatura.
-- ============================================================================

create table plan_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  origin_order_id uuid references plan_orders(id) on delete set null,
  asaas_subscription_id text not null unique,
  status text not null default 'active' check (status in ('active', 'canceled')),
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma assinatura por pedido de origem (idempotência da criação após o pagamento parcelado).
create unique index uq_plan_subscriptions_origin_order
  on plan_subscriptions (origin_order_id)
  where origin_order_id is not null;

create index idx_plan_subscriptions_org_active
  on plan_subscriptions (organization_id)
  where status = 'active';

create trigger trg_plan_subscriptions_updated_at
before update on plan_subscriptions
for each row execute function public.set_updated_at();

alter table plan_subscriptions enable row level security;

create policy plan_subscriptions_select on plan_subscriptions
  for select using (public.is_org_admin(organization_id));

-- ----------------------------------------------------------------------------
-- Carência também depois do vencimento, quando há renovação automática.
-- Espelhar em lib/billing/entitlements.ts (getPlanAccess).
-- ----------------------------------------------------------------------------
create or replace function public.plan_is_usable(p organization_plans)
returns boolean
language sql
stable
set search_path = public
as $$
  select p.id is not null
    and p.status in ('active', 'past_due')
    and (
      p.valid_until > now()
      or (p.auto_renew and p.valid_until + make_interval(days => public.plan_grace_days()) > now())
    )
    and (
      p.status <> 'past_due'
      or p.past_due_since is null
      or p.past_due_since + make_interval(days => public.plan_grace_days()) > now()
    )
$$;

-- ----------------------------------------------------------------------------
-- Reinicia o plano da organização (renovação). Interna: só o servidor chama.
--  - contrato ativo/em atraso: continua o mesmo, com o plano renovado, 6 meses a partir do que for maior
--    entre o vencimento atual e agora, simulações contadas do zero a partir dali, status ativo;
--  - contrato suspenso (estorno/chargeback): não reativa sozinho, devolve NULL;
--  - sem contrato aberto (vencido/cancelado): cria um novo a partir de agora.
-- p_subscription (opcional): assinatura que passa a renovar este contrato.
-- ----------------------------------------------------------------------------
create or replace function public.renew_org_plan(
  p_org uuid,
  p_plan_id uuid,
  p_environment text,
  p_now timestamptz,
  p_subscription text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan plans;
  v_cur organization_plans;
  v_base timestamptz;
  v_id uuid;
begin
  select * into v_plan from plans where id = p_plan_id;

  select * into v_cur
    from organization_plans
   where organization_id = p_org and status <> 'pending'
   order by created_at desc
   limit 1
   for update;

  if found and v_cur.status in ('active', 'past_due') then
    v_base := greatest(v_cur.valid_until, p_now);
    update organization_plans
       set plan_id = v_plan.id,
           max_alternatives = v_plan.max_alternatives,
           runs_limit = v_plan.runs_limit,
           period_started_at = v_base,
           valid_until = v_base + make_interval(months => v_plan.validity_months),
           status = 'active',
           past_due_since = null,
           auto_renew = case when p_subscription is not null then true else auto_renew end,
           asaas_subscription_id = coalesce(p_subscription, asaas_subscription_id)
     where id = v_cur.id
    returning id into v_id;
    return v_id;
  end if;

  if found and v_cur.status = 'suspended' then
    return null;
  end if;

  begin
    insert into organization_plans (
      organization_id, plan_id, status, starts_at, period_started_at, valid_until,
      max_alternatives, runs_limit, auto_renew, asaas_subscription_id, environment
    ) values (
      p_org, v_plan.id, 'active', p_now, p_now, p_now + make_interval(months => v_plan.validity_months),
      v_plan.max_alternatives, v_plan.runs_limit, p_subscription is not null, p_subscription, p_environment
    ) returning id into v_id;
  exception when unique_violation then
    raise exception 'plan_already_open';
  end;
  return v_id;
end;
$$;

revoke execute on function public.renew_org_plan(uuid, uuid, text, timestamptz, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- apply_asaas_payment (versão da renovação). Substitui a de 20261109000000.
-- Retorna um texto com o que foi feito: activated | merged | renewed | attached | already_applied |
-- suspended | past_due | skipped:<motivo>. Erros reais viram exceção (evento FAILED, reprocessável).
-- ----------------------------------------------------------------------------
create or replace function public.apply_asaas_payment(p_asaas_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay asaas_payments;
  v_order plan_orders;
  v_has_order boolean := false;
  v_order_activated boolean := false;
  v_plan plans;
  v_old_plan plans;
  v_existing organization_plans;
  v_new_wins boolean;
  v_contract organization_plans;
  v_contract_id uuid;
  v_sub plan_subscriptions;
  v_ren_order uuid;
  v_now timestamptz := now();
  v_result text;
begin
  select * into v_pay from asaas_payments where asaas_payment_id = p_asaas_payment_id for update;
  if not found then
    return 'skipped:payment_not_found';
  end if;

  if v_pay.order_id is null and v_pay.organization_plan_id is null and v_pay.organization_id is null then
    return 'skipped:no_order';
  end if;

  -- Estorno, chargeback e atraso: atingem o contrato vinculado. Cobrança de assinatura mira o contrato atual
  -- da organização (o vínculo guardado pode ser de um contrato já substituído).
  if v_pay.status in ('REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL', 'OVERDUE') then
    v_contract_id := coalesce(
      case when v_pay.asaas_subscription_id is not null and v_pay.organization_id is not null then
        (select c.id from organization_plans c
          where c.organization_id = v_pay.organization_id and c.status <> 'pending'
          order by c.created_at desc limit 1)
      end,
      v_pay.organization_plan_id,
      (select o.organization_plan_id from plan_orders o where o.id = v_pay.order_id)
    );
    if v_contract_id is null then
      return 'skipped:no_contract';
    end if;

    if v_pay.status = 'OVERDUE' then
      update organization_plans
         set status = 'past_due', past_due_since = coalesce(past_due_since, v_now)
       where id = v_contract_id and status = 'active';
      return case when found then 'past_due' else 'skipped:contract_not_active' end;
    end if;

    update organization_plans
       set status = 'suspended'
     where id = v_contract_id and status in ('active', 'past_due');
    return case when found then 'suspended' else 'skipped:contract_not_open' end;
  end if;

  if v_pay.status not in ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH') then
    return 'skipped:status_' || v_pay.status;
  end if;

  -- Cobrança paga. Trava o pedido (se houver) e relê: evita duas ativações quando as parcelas chegam juntas.
  if v_pay.order_id is not null then
    select * into v_order from plan_orders where id = v_pay.order_id for update;
    if not found then
      return 'skipped:order_not_found';
    end if;
    v_has_order := true;
    v_order_activated := v_order.organization_plan_id is not null;

    if v_pay.organization_id is distinct from v_order.organization_id then
      raise exception 'payment_org_mismatch';
    end if;
    if v_pay.environment <> v_order.environment then
      return 'skipped:environment_mismatch';
    end if;
  elsif v_pay.asaas_subscription_id is null then
    return 'skipped:no_order';
  end if;

  if v_pay.applied_at is not null then
    v_contract_id := v_pay.organization_plan_id;
    v_result := 'already_applied';

  elsif v_pay.asaas_subscription_id is not null and (not v_has_order or v_order_activated) then
    -- Cobrança de renovação de uma assinatura (a 1ª cobrança da assinatura cai no ramo do pedido, abaixo).
    select * into v_sub from plan_subscriptions where asaas_subscription_id = v_pay.asaas_subscription_id;
    if not found then
      return 'skipped:subscription_unknown';
    end if;
    if v_pay.organization_id is not null and v_pay.organization_id <> v_sub.organization_id then
      raise exception 'payment_org_mismatch';
    end if;
    if v_pay.environment <> v_sub.environment then
      return 'skipped:environment_mismatch';
    end if;
    if v_pay.value_cents is null or v_pay.value_cents <= 0 then
      raise exception 'payment_value_mismatch';
    end if;

    v_contract_id := public.renew_org_plan(v_sub.organization_id, v_sub.plan_id, v_sub.environment, v_now, v_sub.asaas_subscription_id);
    if v_contract_id is null then
      return 'skipped:contract_suspended';
    end if;

    -- Cada renovação vira um pedido pago (aparece no histórico de contratações).
    insert into plan_orders (
      organization_id, plan_id, organization_plan_id, kind, payment_method, installment_count,
      amount_cents, auto_renew, status, environment
    ) values (
      v_sub.organization_id, v_sub.plan_id, v_contract_id, 'renewal', 'CREDIT_CARD', 1,
      v_pay.value_cents, true, 'paid', v_sub.environment
    ) returning id into v_ren_order;

    update asaas_payments
       set order_id = v_ren_order, organization_id = v_sub.organization_id,
           organization_plan_id = v_contract_id, applied_at = v_now
     where id = v_pay.id;
    v_result := 'renewed';

  elsif not v_order_activated then
    -- Primeira cobrança paga do pedido. Valor dentro do esperado: de uma parcela até o total do pedido.
    if v_pay.value_cents is null
       or v_pay.value_cents < (v_order.amount_cents / v_order.installment_count) - 1
       or v_pay.value_cents > v_order.amount_cents + 1 then
      raise exception 'payment_value_mismatch';
    end if;

    select * into v_plan from plans where id = v_order.plan_id;

    if v_order.kind = 'renewal' then
      -- Renovação paga por novo checkout (Pix ou cartão): reinicia o plano.
      v_contract_id := public.renew_org_plan(v_order.organization_id, v_order.plan_id, v_order.environment, v_now, null);
      if v_contract_id is null then
        return 'skipped:contract_suspended';
      end if;
      update plan_orders set organization_plan_id = v_contract_id, status = 'paid' where id = v_order.id;
      v_result := 'renewed';
    else
      -- Contratação nova: soma ao plano ativo, ou cria o contrato.
      select * into v_existing
        from organization_plans
       where organization_id = v_order.organization_id
         and status = 'active'
         and valid_until > v_now
       for update;

      if found then
        select * into v_old_plan from plans where id = v_existing.plan_id;
        v_new_wins := v_plan.price_cents > v_old_plan.price_cents;

        update organization_plans
           set plan_id = case when v_new_wins then v_plan.id else plan_id end,
               max_alternatives = max_alternatives + v_plan.max_alternatives,
               runs_limit = case
                 when runs_limit is null or v_plan.runs_limit is null then null
                 else runs_limit + v_plan.runs_limit
               end,
               valid_until = case
                 when v_new_wins then v_now + make_interval(months => v_plan.validity_months)
                 else valid_until
               end
         where id = v_existing.id
        returning * into v_contract;

        update plan_orders set organization_plan_id = v_contract.id, status = 'paid' where id = v_order.id;
        v_contract_id := v_contract.id;
        v_result := 'merged';
      else
        -- Contrato em atraso, suspenso ou vencido por data ainda ocupa o índice único: encerra-o.
        update organization_plans
           set status = case when valid_until <= v_now then 'expired' else 'canceled' end
         where organization_id = v_order.organization_id
           and status in ('active', 'past_due', 'suspended');

        begin
          insert into organization_plans (
            organization_id, plan_id, status, starts_at, period_started_at, valid_until,
            max_alternatives, runs_limit, auto_renew,
            asaas_installment_id, asaas_subscription_id, environment
          ) values (
            v_order.organization_id, v_order.plan_id, 'active', v_now, v_now,
            v_now + make_interval(months => v_plan.validity_months),
            v_plan.max_alternatives, v_plan.runs_limit, v_order.auto_renew,
            v_pay.asaas_installment_id, v_pay.asaas_subscription_id, v_order.environment
          ) returning * into v_contract;
        exception when unique_violation then
          raise exception 'plan_already_open';
        end;

        update plan_orders set organization_plan_id = v_contract.id, status = 'paid' where id = v_order.id;
        v_contract_id := v_contract.id;
        v_result := 'activated';
      end if;
    end if;

    -- Assinatura criada pelo próprio checkout (cartão à vista com renovação): passa a renovar este plano.
    if v_pay.asaas_subscription_id is not null and v_order.auto_renew then
      insert into plan_subscriptions (organization_id, plan_id, origin_order_id, asaas_subscription_id, environment)
      values (v_order.organization_id, v_order.plan_id, v_order.id, v_pay.asaas_subscription_id, v_order.environment)
      on conflict (asaas_subscription_id) do nothing;

      update organization_plans
         set auto_renew = true, asaas_subscription_id = v_pay.asaas_subscription_id
       where id = v_contract_id;
    end if;

    update asaas_payments
       set organization_plan_id = v_contract_id, applied_at = v_now
     where id = v_pay.id;

  else
    -- Parcela seguinte de um pedido já ativado: só se liga ao mesmo contrato.
    v_contract_id := v_order.organization_plan_id;
    v_result := 'attached';
    update asaas_payments
       set organization_plan_id = v_contract_id, applied_at = v_now
     where id = v_pay.id;
  end if;

  -- Pagou o que estava vencido e não há outra cobrança vencida: o plano volta a ativo.
  update organization_plans c
     set status = 'active', past_due_since = null
   where c.id = v_contract_id
     and c.status = 'past_due'
     and not exists (
       select 1 from asaas_payments p
       where p.organization_plan_id = c.id and p.status = 'OVERDUE'
     );

  return v_result;
end;
$$;

revoke execute on function public.apply_asaas_payment(text) from public, anon, authenticated;
