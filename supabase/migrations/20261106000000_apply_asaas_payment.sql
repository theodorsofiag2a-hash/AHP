-- ============================================================================
-- Aplica o efeito de uma cobrança do Asaas sobre o plano da organização.
-- Chamada só pelo servidor (service role), depois que o webhook espelhou a cobrança em asaas_payments.
--
--   paga (CONFIRMED/RECEIVED/RECEIVED_IN_CASH)  -> ativa o plano na 1ª cobrança paga do pedido
--                                                  (as demais parcelas só se ligam ao mesmo plano);
--                                                  se o plano estava em atraso e não há mais atraso, volta a ativo
--   vencida (OVERDUE)                           -> plano ativo passa a em atraso (começa a carência)
--   estornada / chargeback                      -> plano ativo ou em atraso passa a suspenso
--
-- Idempotente (applied_at) e segura contra parcelas processadas ao mesmo tempo: trava a cobrança e depois
-- o pedido, então a 2ª e a 3ª parcela esperam a 1ª e apenas se ligam ao plano já criado.
-- Retorna um texto com o que foi feito (para log); erros reais viram exceção e o evento fica FAILED.
-- ============================================================================

create or replace function public.apply_asaas_payment(p_asaas_payment_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pay asaas_payments;
  v_order plan_orders;
  v_plan plans;
  v_contract organization_plans;
  v_contract_id uuid;
  v_now timestamptz := now();
  v_result text;
begin
  select * into v_pay from asaas_payments where asaas_payment_id = p_asaas_payment_id for update;
  if not found then
    return 'skipped:payment_not_found';
  end if;

  if v_pay.order_id is null and v_pay.organization_plan_id is null then
    return 'skipped:no_order';
  end if;

  -- Estorno e chargeback: suspende o plano vinculado.
  if v_pay.status in ('REFUNDED', 'CHARGEBACK_REQUESTED', 'CHARGEBACK_DISPUTE', 'AWAITING_CHARGEBACK_REVERSAL') then
    v_contract_id := coalesce(
      v_pay.organization_plan_id,
      (select o.organization_plan_id from plan_orders o where o.id = v_pay.order_id)
    );
    if v_contract_id is null then
      return 'skipped:no_contract';
    end if;
    update organization_plans
       set status = 'suspended'
     where id = v_contract_id and status in ('active', 'past_due');
    return case when found then 'suspended' else 'skipped:contract_not_open' end;
  end if;

  -- Cobrança vencida: o plano entra em atraso e começa a carência.
  if v_pay.status = 'OVERDUE' then
    v_contract_id := coalesce(
      v_pay.organization_plan_id,
      (select o.organization_plan_id from plan_orders o where o.id = v_pay.order_id)
    );
    if v_contract_id is null then
      return 'skipped:no_contract';
    end if;
    update organization_plans
       set status = 'past_due', past_due_since = coalesce(past_due_since, v_now)
     where id = v_contract_id and status = 'active';
    return case when found then 'past_due' else 'skipped:contract_not_active' end;
  end if;

  if v_pay.status not in ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH') then
    return 'skipped:status_' || v_pay.status;
  end if;

  -- Cobrança paga.
  if v_pay.order_id is null then
    return 'skipped:no_order';
  end if;

  -- Trava o pedido (e relê): evita duas ativações quando as parcelas chegam juntas.
  select * into v_order from plan_orders where id = v_pay.order_id for update;
  if not found then
    return 'skipped:order_not_found';
  end if;

  if v_pay.organization_id is distinct from v_order.organization_id then
    raise exception 'payment_org_mismatch';
  end if;
  if v_pay.environment <> v_order.environment then
    return 'skipped:environment_mismatch';
  end if;

  if v_pay.applied_at is not null then
    v_contract_id := v_pay.organization_plan_id;
    v_result := 'already_applied';
  else
    -- Valor dentro do esperado: de uma parcela até o total do pedido. Fora disso, não ativa.
    if v_pay.value_cents is null
       or v_pay.value_cents < (v_order.amount_cents / v_order.installment_count) - 1
       or v_pay.value_cents > v_order.amount_cents + 1 then
      raise exception 'payment_value_mismatch';
    end if;

    if v_order.organization_plan_id is null then
      select * into v_plan from plans where id = v_order.plan_id;

      -- Contratos ativos/em atraso já vencidos por data ainda ocupam o índice único: encerra-os.
      update organization_plans
         set status = 'expired'
       where organization_id = v_order.organization_id
         and status in ('active', 'past_due')
         and valid_until <= v_now;

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

      update plan_orders
         set organization_plan_id = v_contract.id, status = 'paid'
       where id = v_order.id;

      v_contract_id := v_contract.id;
      v_result := 'activated';
    else
      v_contract_id := v_order.organization_plan_id;
      v_result := 'attached';
    end if;

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

-- Só o servidor (service role) chama. No Supabase, anon/authenticated recebem EXECUTE por padrão em função
-- nova: sem este revoke qualquer usuário ativaria um plano para si.
revoke execute on function public.apply_asaas_payment(text) from public, anon, authenticated;
