-- Gestão de estrutura (modelos/pilares/subcritérios/escalas) deixou de ter qualquer
-- superfície no app: nenhum usuário autenticado (nenhum papel) pode criar/editar/excluir
-- essas tabelas via API — só leitura (necessária para listar modelos, rodar a matriz e
-- preencher fichas de avaliação). Escrita passa a ser exclusivamente via terminal/service role.

drop policy if exists ahp_models_insert on ahp_models;
drop policy if exists ahp_models_update on ahp_models;
drop policy if exists ahp_models_delete on ahp_models;

drop policy if exists ahp_pillars_insert on ahp_pillars;
drop policy if exists ahp_pillars_update on ahp_pillars;
drop policy if exists ahp_pillars_delete on ahp_pillars;

drop policy if exists ahp_subcriteria_insert on ahp_subcriteria;
drop policy if exists ahp_subcriteria_update on ahp_subcriteria;
drop policy if exists ahp_subcriteria_delete on ahp_subcriteria;

drop policy if exists ahp_scales_insert on ahp_scales;
drop policy if exists ahp_scales_update on ahp_scales;
drop policy if exists ahp_scales_delete on ahp_scales;

drop function if exists public.is_org_admin(uuid);
