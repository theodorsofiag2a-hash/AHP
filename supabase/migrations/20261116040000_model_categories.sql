-- ============================================================================
-- Categoria do modelo: a tela de modelos mostra só "Fabricante" e "Projeto"; dentro de "Projeto"
-- ficam as visões (Investidor e Fabricante). A estrutura do modelo segue gravável só por service_role.
--   category:      'fabricante' ou 'projeto' (nulo = aparece sozinho, com o próprio nome);
--   variant_label: nome da visão dentro da categoria (ex.: Investidor).
-- ============================================================================

alter table ahp_models
  add column category text check (category in ('fabricante', 'projeto')),
  add column variant_label text;
