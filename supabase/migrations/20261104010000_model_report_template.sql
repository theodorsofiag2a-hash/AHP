-- Marca os modelos que usam filtros eliminatórios e o relatório de priorização de projetos BESS.
-- Quem define isso é a G2A (por SQL/painel); modelos sem marca (ex.: Fabricante) não mostram nada disso.
alter table public.ahp_models
  add column if not exists report_template text
  check (report_template is null or report_template in ('bess_project'));
