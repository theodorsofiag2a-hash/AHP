-- ============================================================================
-- Municípios do Brasil (lista do IBGE) e Ng (densidade de descargas atmosféricas, raios/km²/ano).
--
-- A lista de municípios é pública e entra completa. O Ng vem da ABNT NBR 5419-2:2026 (norma paga,
-- não entra no Git): a coluna nasce vazia e é carregada por fora. Enquanto o Ng de um município
-- estiver vazio, o parâmetro de descargas atmosféricas continua sendo escolhido na ficha, à mão.
-- ============================================================================

create table municipalities (
  ibge_code int primary key,
  name text not null,
  uf text not null check (char_length(uf) = 2),
  ng numeric(6, 2) check (ng is null or ng >= 0),
  ng_source text
);

create index idx_municipalities_uf_name on municipalities(uf, name);

alter table municipalities enable row level security;

-- Dado de referência: usuário autenticado lê; ninguém escreve pela API (só service_role).
create policy municipalities_select on municipalities
  for select to authenticated using (true);

revoke all on municipalities from anon;
revoke insert, update, delete, truncate on municipalities from authenticated;
grant all on municipalities to service_role;

-- Município do projeto (alternativa).
alter table ahp_alternatives
  add column municipality_ibge int references municipalities(ibge_code) on delete set null;

-- Preenchimento automático da ficha a partir de um dado do projeto.
--   auto_source: de onde vem o valor (hoje só 'ng', do município do projeto);
--   auto_match:  condição da faixa sobre esse valor. Chaves aceitas: gt, gte, lt, lte, eq.
alter table ahp_subcriteria
  add column auto_source text check (auto_source in ('ng'));

alter table ahp_scales
  add column auto_match jsonb check (auto_match is null or jsonb_typeof(auto_match) = 'object');
