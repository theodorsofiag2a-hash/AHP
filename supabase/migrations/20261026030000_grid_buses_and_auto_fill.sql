-- ============================================================================
-- Barramentos candidatos do LRCAP Armazenamento 2026 (NT-ONS DPL 0095/2026, Rev 0,
-- Tabela 4-1) e preenchimento automático da ficha de avaliação a partir deles.
--
-- Os DADOS não ficam no repositório: a tabela nasce vazia e é carregada por fora do Git
-- (a fonte usada até aqui é uma página de terceiros, Carpe Vie, ainda sem autorização
-- de reuso formalizada). Esta migration só cria a estrutura.
-- ============================================================================

create table grid_buses (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  source_revision text not null,
  source_row int not null,
  uf text not null,
  name text not null,
  kv int not null check (kv > 0),
  -- Margens de escoamento (MW). Limites de subárea e área valem em conjunto e não se somam.
  bus_margin_mw numeric(8, 2) not null check (bus_margin_mw >= 0),
  subarea_margin_mw numeric(8, 2) not null check (subarea_margin_mw >= 0),
  area_margin_mw numeric(8, 2) not null check (area_margin_mw >= 0),
  subarea_expr text,
  area_expr text,
  -- Notas 1 a 7 da Tabela 4-1 (restrições do barramento).
  notes smallint[] not null default '{}',
  -- Viabilidade física (Tabela 5-1): A = possibilidade de novas conexões; B = sem possibilidade.
  -- NULL: barramento virtual/seccionamento, que não consta da Tabela 5-1.
  physical_class text check (physical_class in ('A', 'B')),
  -- Barramento bonificado (Anexo II da Portaria MME 136/2026).
  bonified boolean not null default false,
  tust_g numeric(8, 2),
  tusd_g numeric(8, 2),
  transmissora text,
  created_at timestamptz not null default now(),
  unique (source_revision, source_row)
);

create index idx_grid_buses_uf on grid_buses(uf);

alter table grid_buses enable row level security;

-- Dado de referência público dentro do produto: qualquer usuário autenticado lê; ninguém
-- escreve pela API (só service_role). anon não enxerga nada.
create policy grid_buses_select on grid_buses
  for select to authenticated using (true);

revoke all on grid_buses from anon;
revoke insert, update, delete, truncate on grid_buses from authenticated;

-- Vínculo da alternativa (projeto) com o barramento escolhido e a potência pretendida.
alter table ahp_alternatives
  add column bus_id uuid references grid_buses(id) on delete set null,
  add column power_mw numeric(8, 2) check (power_mw is null or (power_mw > 0 and power_mw <= 5000));

create index idx_ahp_alternatives_bus on ahp_alternatives(bus_id);

-- Regras de preenchimento automático (estrutura do modelo: escrita só por service_role).
--   auto_field: qual atributo do barramento alimenta o subcritério;
--   auto_match: condição da escala sobre esse atributo. Chaves aceitas: gt, gte, lt, lte, eq.
alter table ahp_subcriteria
  add column auto_field text check (auto_field in ('tariff_g', 'kv', 'bonified', 'is_sectioning'));

alter table ahp_scales
  add column auto_match jsonb check (auto_match is null or jsonb_typeof(auto_match) = 'object');
