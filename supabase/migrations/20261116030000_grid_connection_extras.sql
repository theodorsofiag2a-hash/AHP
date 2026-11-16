-- ============================================================================
-- Conexão (grid_buses) + parâmetros do Parametros_Consolidado v2 preenchidos pelo barramento.
--
--   must_mw: MUST contratado do projeto (MW), usado no EUST = TUST x MUST;
--   auto_field ganha: bus_class_b (restrição tipo B), margin_multiple (margem efetiva / potência)
--   e eust (TUST x MUST, para o subcritério relativo à carteira).
-- ============================================================================

alter table ahp_alternatives
  add column must_mw numeric(8, 2) check (must_mw is null or (must_mw > 0 and must_mw <= 5000));

alter table ahp_subcriteria drop constraint if exists ahp_subcriteria_auto_field_check;
alter table ahp_subcriteria
  add constraint ahp_subcriteria_auto_field_check
  check (auto_field is null or auto_field in ('tariff_g', 'kv', 'bonified', 'is_sectioning', 'bus_class_b', 'margin_multiple', 'eust'));
