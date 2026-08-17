-- G2A AHP — schema inicial
-- Multi-tenant via organizations + organization_members, RLS por organização.
-- Créditos: ledger append-only (credit_transactions) + saldo materializado (organization_credit_balance),
-- sincronizados atomicamente por trigger BEFORE INSERT (lock de linha), nunca calculados na aplicação.

create extension if not exists pgcrypto;
create extension if not exists unaccent;

-- ============================================================================
-- Helpers
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.is_org_member(p_organization_id uuid)
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
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.generate_org_slug(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_slug text;
  v_exists boolean;
begin
  v_base := lower(regexp_replace(unaccent(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base := trim(both '-' from v_base);
  if v_base = '' then
    v_base := 'org';
  end if;

  v_slug := v_base;
  loop
    select exists(select 1 from organizations where slug = v_slug) into v_exists;
    exit when not v_exists;
    v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 5);
  end loop;

  return v_slug;
end;
$$;

-- ============================================================================
-- Identidade e organização (multi-tenant)
-- ============================================================================

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  logo_url text,
  billing_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_organizations_updated_at
before update on organizations
for each row execute function public.set_updated_at();

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  primary key (organization_id, user_id)
);

create index idx_organization_members_user on organization_members(user_id);

alter table organizations enable row level security;
alter table organization_members enable row level security;

create policy organizations_select on organizations
  for select using (public.is_org_member(id));
create policy organizations_update on organizations
  for update using (public.is_org_member(id));

create policy organization_members_select on organization_members
  for select using (user_id = auth.uid() or public.is_org_member(organization_id));

-- ============================================================================
-- Modelos AHP (Modelo -> Pilares -> Subcritérios -> Escalas)
-- ============================================================================

create table ahp_models (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, slug)
);

create index idx_ahp_models_org on ahp_models(organization_id);

create trigger trg_ahp_models_updated_at
before update on ahp_models
for each row execute function public.set_updated_at();

create table ahp_pillars (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references ahp_models(id) on delete cascade,
  name text not null,
  sort_order int not null default 0
);

create index idx_ahp_pillars_model on ahp_pillars(model_id);

create table ahp_subcriteria (
  id uuid primary key default gen_random_uuid(),
  pillar_id uuid not null references ahp_pillars(id) on delete cascade,
  name text not null,
  weight_pct numeric(5, 2) not null check (weight_pct >= 0 and weight_pct <= 100),
  sort_order int not null default 0
);

create index idx_ahp_subcriteria_pillar on ahp_subcriteria(pillar_id);

create table ahp_scales (
  id uuid primary key default gen_random_uuid(),
  subcriterion_id uuid not null references ahp_subcriteria(id) on delete cascade,
  description text not null,
  fulfillment_pct numeric(5, 2) not null check (fulfillment_pct >= 0 and fulfillment_pct <= 100),
  sort_order int not null default 0
);

create index idx_ahp_scales_subcriterion on ahp_scales(subcriterion_id);

alter table ahp_models enable row level security;
alter table ahp_pillars enable row level security;
alter table ahp_subcriteria enable row level security;
alter table ahp_scales enable row level security;

create policy ahp_models_all on ahp_models
  for all using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy ahp_pillars_all on ahp_pillars
  for all using (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_member(m.organization_id))
  )
  with check (
    exists (select 1 from ahp_models m where m.id = ahp_pillars.model_id and public.is_org_member(m.organization_id))
  );

create policy ahp_subcriteria_all on ahp_subcriteria
  for all using (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_member(m.organization_id)
    )
  )
  with check (
    exists (
      select 1 from ahp_pillars p
      join ahp_models m on m.id = p.model_id
      where p.id = ahp_subcriteria.pillar_id and public.is_org_member(m.organization_id)
    )
  );

create policy ahp_scales_all on ahp_scales
  for all using (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_member(m.organization_id)
    )
  )
  with check (
    exists (
      select 1 from ahp_subcriteria s
      join ahp_pillars p on p.id = s.pillar_id
      join ahp_models m on m.id = p.model_id
      where s.id = ahp_scales.subcriterion_id and public.is_org_member(m.organization_id)
    )
  );

-- ============================================================================
-- Alternativas e avaliações
-- ============================================================================

create table ahp_alternatives (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references ahp_models(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (model_id, name)
);

create index idx_ahp_alternatives_model on ahp_alternatives(model_id);

create trigger trg_ahp_alternatives_updated_at
before update on ahp_alternatives
for each row execute function public.set_updated_at();

create table ahp_alternative_scores (
  id uuid primary key default gen_random_uuid(),
  alternative_id uuid not null references ahp_alternatives(id) on delete cascade,
  subcriterion_id uuid not null references ahp_subcriteria(id) on delete cascade,
  scale_id uuid not null references ahp_scales(id),
  score_value numeric(5, 2) not null,
  unique (alternative_id, subcriterion_id)
);

create index idx_ahp_alternative_scores_alternative on ahp_alternative_scores(alternative_id);

alter table ahp_alternatives enable row level security;
alter table ahp_alternative_scores enable row level security;

create policy ahp_alternatives_all on ahp_alternatives
  for all using (
    exists (select 1 from ahp_models m where m.id = ahp_alternatives.model_id and public.is_org_member(m.organization_id))
  )
  with check (
    exists (select 1 from ahp_models m where m.id = ahp_alternatives.model_id and public.is_org_member(m.organization_id))
  );

create policy ahp_alternative_scores_all on ahp_alternative_scores
  for all using (
    exists (
      select 1 from ahp_alternatives a
      join ahp_models m on m.id = a.model_id
      where a.id = ahp_alternative_scores.alternative_id and public.is_org_member(m.organization_id)
    )
  )
  with check (
    exists (
      select 1 from ahp_alternatives a
      join ahp_models m on m.id = a.model_id
      where a.id = ahp_alternative_scores.alternative_id and public.is_org_member(m.organization_id)
    )
  );

-- ============================================================================
-- Execuções AHP (matriz de comparação + resultado + CR)
-- ============================================================================

create table ahp_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  model_id uuid not null references ahp_models(id) on delete cascade,
  run_by uuid references auth.users(id),
  status text not null default 'completed' check (status in ('completed', 'failed')),
  consistency_ratio numeric(6, 4) not null,
  consistency_ok boolean generated always as (consistency_ratio <= 0.10) stored,
  lambda_max numeric(10, 6),
  pillar_comparisons jsonb not null,
  pillar_weights jsonb not null,
  credit_transaction_id uuid,
  created_at timestamptz not null default now()
);

create index idx_ahp_runs_org on ahp_runs(organization_id);
create index idx_ahp_runs_model on ahp_runs(model_id, created_at desc);

create table ahp_run_results (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ahp_runs(id) on delete cascade,
  alternative_id uuid not null references ahp_alternatives(id) on delete cascade,
  final_score numeric(8, 2) not null,
  rank int not null,
  pillar_scores jsonb not null,
  pillar_scores_radar jsonb not null
);

create index idx_ahp_run_results_run on ahp_run_results(run_id);

alter table ahp_runs enable row level security;
alter table ahp_run_results enable row level security;

-- Escrita de ahp_runs/ahp_run_results só via função SECURITY DEFINER create_ahp_run() (débito atômico de crédito).
create policy ahp_runs_select on ahp_runs
  for select using (public.is_org_member(organization_id));

create policy ahp_run_results_select on ahp_run_results
  for select using (
    exists (select 1 from ahp_runs r where r.id = ahp_run_results.run_id and public.is_org_member(r.organization_id))
  );

-- ============================================================================
-- Créditos (agnóstico a gateway de pagamento)
-- ============================================================================

create table credit_packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  credits int not null check (credits > 0),
  price_cents int not null check (price_cents >= 0),
  currency text not null default 'BRL',
  external_ref text,
  active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table organization_credit_balance (
  organization_id uuid primary key references organizations(id) on delete cascade,
  balance int not null default 0,
  updated_at timestamptz not null default now()
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type text not null check (type in ('purchase', 'consumption', 'refund', 'adjustment', 'bonus', 'manual_grant')),
  amount int not null check (amount <> 0),
  balance_after int not null,
  related_run_id uuid references ahp_runs(id),
  related_external_payment_id text,
  description text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index idx_credit_transactions_org on credit_transactions(organization_id, created_at desc);

-- Mantém organization_credit_balance sincronizado atomicamente a cada transação
-- (lock de linha evita corrida em débitos concorrentes; bloqueia saldo negativo).
create or replace function public.credit_transactions_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance int;
begin
  insert into organization_credit_balance (organization_id, balance)
  values (new.organization_id, 0)
  on conflict (organization_id) do nothing;

  select balance into v_balance
  from organization_credit_balance
  where organization_id = new.organization_id
  for update;

  v_balance := v_balance + new.amount;

  if v_balance < 0 then
    raise exception 'insufficient_credits';
  end if;

  new.balance_after := v_balance;

  update organization_credit_balance
  set balance = v_balance, updated_at = now()
  where organization_id = new.organization_id;

  return new;
end;
$$;

create trigger trg_credit_transactions_before_insert
before insert on credit_transactions
for each row execute function public.credit_transactions_before_insert();

alter table credit_packages enable row level security;
alter table organization_credit_balance enable row level security;
alter table credit_transactions enable row level security;

create policy credit_packages_select on credit_packages
  for select using (active = true);

create policy organization_credit_balance_select on organization_credit_balance
  for select using (public.is_org_member(organization_id));

create policy credit_transactions_select on credit_transactions
  for select using (public.is_org_member(organization_id));

-- Inserts em credit_transactions só via service role (concessão manual/futuro gateway) ou via
-- create_ahp_run() abaixo (SECURITY DEFINER) — nenhuma policy de INSERT para authenticated.

-- ============================================================================
-- Execução atômica: cria ahp_run + ahp_run_results + débito de 1 crédito
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
begin
  if not public.is_org_member(p_organization_id) then
    raise exception 'not_org_member';
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
-- Insights (reservado — sem integração de LLM nesta fase)
-- ============================================================================

create table ahp_insights (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references ahp_runs(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  requested_by uuid references auth.users(id),
  model_used text not null,
  prompt_input jsonb not null,
  content text not null,
  tokens_input int,
  tokens_output int,
  created_at timestamptz not null default now()
);

create index idx_ahp_insights_run on ahp_insights(run_id);

alter table ahp_insights enable row level security;

create policy ahp_insights_select on ahp_insights
  for select using (public.is_org_member(organization_id));

-- ============================================================================
-- Onboarding automático: signup cria organização + membership (owner) + saldo (0)
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_org_name text;
begin
  v_org_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'organization_name'), ''), split_part(new.email, '@', 1));

  insert into organizations (name, slug)
  values (v_org_name, public.generate_org_slug(v_org_name))
  returning id into v_org_id;

  insert into organization_members (organization_id, user_id, role, joined_at)
  values (v_org_id, new.id, 'owner', now());

  insert into organization_credit_balance (organization_id, balance)
  values (v_org_id, 0);

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();
