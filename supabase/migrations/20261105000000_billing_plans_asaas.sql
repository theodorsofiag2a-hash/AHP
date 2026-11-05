-- ============================================================================
-- Cobrança por planos (integração Asaas Checkout).
--
-- Só ADICIONA: tabelas novas, um índice e triggers. NÃO redefine create_ahp_run(): as regras de plano
-- ficam em triggers de ahp_runs e credit_transactions, que valem para qualquer versão dessa função
-- (a branch staging redefine create_ahp_run com um parâmetro extra; reescrevê-la aqui seria sobrescrito
-- por aquela migration e removeria as regras de plano em silêncio).
-- Nada é apagado nem alterado nos dados existentes.
--
-- Regime de cobrança por organização:
--   * sem nenhuma contratação  -> regime legado de créditos (como hoje, inclusive concessões manuais);
--   * com contratação (≠ pending) -> regime de plano: exige plano utilizável (ativo/em atraso dentro da
--     carência e dentro da validade), aplica teto de alternativas e limite de simulações no banco, e
--     NÃO debita crédito.
-- O limite vive no banco (e não só na aplicação) porque a RLS deixa qualquer membro inserir
-- alternativas direto pelo PostgREST.
--
-- Fonte do catálogo para a interface: lib/plans.ts. As linhas semeadas em "plans" precisam bater com
-- ele (código, preço, faixa, simulações); a interface exibe lib/plans.ts, o banco aplica "plans".
-- ============================================================================

-- ============================================================================
-- Catálogo de planos (aplicado pelo banco)
-- ============================================================================

create table plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  price_cents int not null check (price_cents > 0),
  max_alternatives int not null check (max_alternatives > 0),
  -- null = simulações ilimitadas
  runs_limit int check (runs_limit is null or runs_limit > 0),
  validity_months int not null default 6 check (validity_months > 0),
  max_installments int not null default 3 check (max_installments between 1 and 21),
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table plans enable row level security;

create policy plans_select on plans
  for select using (active = true);

-- Fonte: Tabela_Precificacao.xlsx (aba "Tabela de Preços"). Nomes provisórios. Só o teto superior da
-- faixa de projetos é aplicado; P3/P4 sem limite de simulações definido -> ilimitadas.
insert into plans (code, name, price_cents, max_alternatives, runs_limit, validity_months, max_installments, sort_order)
values
  ('P1', 'Entrada',        500000,  10, 10,   6, 3, 1),
  ('P2', 'Intermediário', 1000000,  18, null, 6, 3, 2),
  ('P3', 'Avançado',      3500000,  50, null, 6, 3, 3),
  ('P4', 'Corporativo',   5000000, 100, null, 6, 3, 4)
on conflict (code) do nothing;

-- ============================================================================
-- Dados de cobrança da organização (alimentam o customerData do Checkout)
-- Leitura só para owner/admin; escrita só pelo servidor (service role).
-- ============================================================================

create table billing_profiles (
  organization_id uuid primary key references organizations(id) on delete cascade,
  legal_name text not null,
  cpf_cnpj text not null check (cpf_cnpj ~ '^[0-9]{11}$' or cpf_cnpj ~ '^[0-9]{14}$'),
  email text not null,
  phone text,
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  address text,
  address_number text,
  complement text,
  province text,
  city_code int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_billing_profiles_updated_at
before update on billing_profiles
for each row execute function public.set_updated_at();

alter table billing_profiles enable row level security;

create policy billing_profiles_select on billing_profiles
  for select using (public.is_org_admin(organization_id));

-- ============================================================================
-- Contratação (direito de uso do plano)
-- Limites copiados do plano no momento da compra: mudar o catálogo depois não altera contratos.
-- ============================================================================

create table organization_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'past_due', 'suspended', 'expired', 'canceled')),
  starts_at timestamptz,
  -- início do período vigente (a renovação avança este campo); as simulações são contadas a partir dele
  period_started_at timestamptz,
  valid_until timestamptz,
  max_alternatives int not null check (max_alternatives > 0),
  runs_limit int check (runs_limit is null or runs_limit > 0),
  auto_renew boolean not null default false,
  past_due_since timestamptz,
  asaas_customer_id text,
  asaas_installment_id text,
  asaas_subscription_id text,
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    status = 'pending'
    or (starts_at is not null and period_started_at is not null and valid_until is not null)
  ),
  check (valid_until is null or starts_at is null or valid_until > starts_at)
);

-- Uma contratação "aberta" por organização (pendente, ativa, em atraso ou suspensa).
create unique index uq_organization_plans_open
  on organization_plans (organization_id)
  where status in ('pending', 'active', 'past_due', 'suspended');

create index idx_organization_plans_org on organization_plans (organization_id, created_at desc);
create index idx_organization_plans_plan on organization_plans (plan_id);

create trigger trg_organization_plans_updated_at
before update on organization_plans
for each row execute function public.set_updated_at();

alter table organization_plans enable row level security;

create policy organization_plans_select on organization_plans
  for select using (public.is_org_member(organization_id));

-- ============================================================================
-- Pedidos de compra (cada tentativa). O id do pedido identifica a compra no Asaas.
-- Atenção: o Asaas NÃO repassa o externalReference do checkout às cobranças; a ligação é feita pelo
-- id do checkout (payment.checkoutSession), por isso asaas_checkout_id é único.
-- ============================================================================

create table plan_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  organization_plan_id uuid references organization_plans(id) on delete set null,
  kind text not null default 'initial' check (kind in ('initial', 'renewal')),
  payment_method text not null check (payment_method in ('CREDIT_CARD', 'PIX')),
  installment_count int not null default 1 check (installment_count between 1 and 21),
  amount_cents int not null check (amount_cents > 0),
  auto_renew boolean not null default false,
  status text not null default 'creating'
    check (status in ('creating', 'awaiting_payment', 'paid', 'canceled', 'expired', 'failed')),
  asaas_checkout_id text unique,
  checkout_url text,
  environment text not null check (environment in ('sandbox', 'production')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- No máximo um pedido em aberto por organização (barra compra paralela e clique duplo).
create unique index uq_plan_orders_open
  on plan_orders (organization_id)
  where status in ('creating', 'awaiting_payment');

create index idx_plan_orders_org on plan_orders (organization_id, created_at desc);
create index idx_plan_orders_plan on plan_orders (plan_id);
create index idx_plan_orders_org_plan on plan_orders (organization_plan_id);

create trigger trg_plan_orders_updated_at
before update on plan_orders
for each row execute function public.set_updated_at();

alter table plan_orders enable row level security;

create policy plan_orders_select on plan_orders
  for select using (public.is_org_admin(organization_id));

-- ============================================================================
-- Espelho das cobranças do Asaas (parcelas, cobranças de assinatura)
-- applied_at marca que o efeito da cobrança (ativar/estender plano) já foi aplicado: idempotência.
-- ============================================================================

create table asaas_payments (
  id uuid primary key default gen_random_uuid(),
  asaas_payment_id text unique not null,
  organization_id uuid references organizations(id) on delete cascade,
  order_id uuid references plan_orders(id) on delete set null,
  organization_plan_id uuid references organization_plans(id) on delete set null,
  asaas_checkout_id text,
  asaas_installment_id text,
  asaas_subscription_id text,
  installment_number int,
  status text not null,
  billing_type text,
  value_cents int,
  due_date date,
  confirmed_at timestamptz,
  credit_date date,
  applied_at timestamptz,
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_asaas_payments_org on asaas_payments (organization_id);
create index idx_asaas_payments_order on asaas_payments (order_id);
create index idx_asaas_payments_org_plan on asaas_payments (organization_plan_id);
create index idx_asaas_payments_checkout on asaas_payments (asaas_checkout_id);
create index idx_asaas_payments_installment on asaas_payments (asaas_installment_id);
create index idx_asaas_payments_subscription on asaas_payments (asaas_subscription_id);

create trigger trg_asaas_payments_updated_at
before update on asaas_payments
for each row execute function public.set_updated_at();

alter table asaas_payments enable row level security;

create policy asaas_payments_select on asaas_payments
  for select using (organization_id is not null and public.is_org_admin(organization_id));

-- ============================================================================
-- Caixa de entrada dos webhooks. asaas_event_id UNIQUE: entrega "at least once" vira efeito único.
-- Sem policies de propósito: só o servidor (service role) lê e escreve.
-- ============================================================================

create table asaas_events (
  id uuid primary key default gen_random_uuid(),
  asaas_event_id text unique not null,
  event_type text,
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'DONE', 'FAILED')),
  attempts int not null default 0,
  last_error text,
  environment text not null check (environment in ('sandbox', 'production')),
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_asaas_events_pending on asaas_events (status, received_at);

alter table asaas_events enable row level security;

-- ============================================================================
-- Segunda barreira contra crédito/efeito duplicado por pagamento do Asaas.
-- ============================================================================

create unique index if not exists uq_credit_transactions_external_payment
  on credit_transactions (related_external_payment_id)
  where related_external_payment_id is not null;

-- ============================================================================
-- Regras de plano (funções internas: só rodam dentro de funções SECURITY DEFINER e triggers)
-- ============================================================================

-- Carência após o vencimento de uma parcela antes de suspender o acesso. Espelhar em lib/billing.
create or replace function public.plan_grace_days()
returns int
language sql
immutable
set search_path = public
as $$
  select 10
$$;

-- Contratação "vigente" da organização: a mais recente que não é pendente. Sem linha -> regime legado.
create or replace function public.current_org_plan(p_organization_id uuid)
returns organization_plans
language sql
stable
security definer
set search_path = public
as $$
  select *
  from organization_plans
  where organization_id = p_organization_id
    and status <> 'pending'
  order by created_at desc
  limit 1
$$;

-- Plano utilizável: ativo, ou em atraso dentro da carência, e dentro da validade.
create or replace function public.plan_is_usable(p organization_plans)
returns boolean
language sql
stable
set search_path = public
as $$
  select p.id is not null
    and p.status in ('active', 'past_due')
    and p.valid_until > now()
    and (
      p.status <> 'past_due'
      or p.past_due_since is null
      or p.past_due_since + make_interval(days => public.plan_grace_days()) > now()
    )
$$;

-- Teto de alternativas por organização (todas as alternativas de todos os modelos).
create or replace function public.enforce_plan_alternatives_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_plan organization_plans;
  v_count int;
begin
  select m.organization_id into v_org from ahp_models m where m.id = new.model_id;
  if v_org is null then
    return new; -- a FK/RLS já rejeita modelo inexistente
  end if;

  v_plan := public.current_org_plan(v_org);
  if v_plan.id is null then
    return new; -- regime legado de créditos: sem teto
  end if;

  -- Trava a contratação para serializar inserts concorrentes na última vaga; relê sob o lock.
  perform 1 from organization_plans where id = v_plan.id for update;
  v_plan := public.current_org_plan(v_org);

  if not public.plan_is_usable(v_plan) then
    raise exception 'plan_not_active';
  end if;

  select count(*) into v_count
  from ahp_alternatives a
  join ahp_models m on m.id = a.model_id
  where m.organization_id = v_org;

  if v_count >= v_plan.max_alternatives then
    raise exception 'plan_alternatives_limit';
  end if;

  return new;
end;
$$;

create trigger trg_ahp_alternatives_plan_limit
before insert on ahp_alternatives
for each row execute function public.enforce_plan_alternatives_limit();


-- ============================================================================
-- Execuções (ahp_runs): plano utilizável e limite de simulações do período.
-- ahp_runs só é escrita por create_ahp_run() (SECURITY DEFINER); o trigger vale para qualquer versão dela.
-- ============================================================================

create or replace function public.enforce_plan_runs_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan organization_plans;
  v_used int;
begin
  v_plan := public.current_org_plan(new.organization_id);
  if v_plan.id is null then
    return new; -- regime legado de créditos
  end if;

  -- Trava a contratação até o fim da transação: execuções simultâneas não furam o limite.
  perform 1 from organization_plans where id = v_plan.id for update;
  v_plan := public.current_org_plan(new.organization_id);

  if not public.plan_is_usable(v_plan) then
    raise exception 'plan_not_active';
  end if;

  if v_plan.runs_limit is not null then
    select count(*) into v_used
    from ahp_runs
    where organization_id = new.organization_id
      and created_at >= v_plan.period_started_at;

    if v_used >= v_plan.runs_limit then
      raise exception 'plan_runs_exhausted';
    end if;
  end if;

  return new;
end;
$$;

create trigger trg_ahp_runs_plan_limit
before insert on ahp_runs
for each row execute function public.enforce_plan_runs_limit();

-- ============================================================================
-- Créditos: no regime de plano a execução não consome crédito. create_ahp_run() insere a linha de
-- 'consumption'; este trigger a descarta (return null) antes do trigger do ledger. O nome começa com
-- "trg_credit_c", que ordena antes de "trg_credit_transactions_before_insert" (triggers BEFORE rodam em
-- ordem alfabética); sem isso o saldo seria debitado (e daria insufficient_credits para saldo zero).
-- ============================================================================

create or replace function public.skip_credit_consumption_under_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.type = 'consumption' and (public.current_org_plan(new.organization_id)).id is not null then
    return null;
  end if;
  return new;
end;
$$;

create trigger trg_credit_consumption_under_plan
before insert on credit_transactions
for each row execute function public.skip_credit_consumption_under_plan();

-- ============================================================================
-- Permissões das funções internas. No Supabase, anon e authenticated recebem EXECUTE por privilégio
-- padrão em funções novas; revogar só de PUBLIC não basta (confirmado no banco de teste: sem isto,
-- qualquer usuário chamava current_org_plan() e lia o plano de qualquer organização).
-- Só triggers e funções SECURITY DEFINER (rodando como dono) usam estas funções.
-- ============================================================================

revoke execute on function public.plan_grace_days() from public, anon, authenticated;
revoke execute on function public.current_org_plan(uuid) from public, anon, authenticated;
revoke execute on function public.plan_is_usable(organization_plans) from public, anon, authenticated;
revoke execute on function public.enforce_plan_alternatives_limit() from public, anon, authenticated;
revoke execute on function public.enforce_plan_runs_limit() from public, anon, authenticated;
revoke execute on function public.skip_credit_consumption_under_plan() from public, anon, authenticated;
