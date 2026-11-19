-- Correção: o parâmetro de Conexão da versão gratuita é o nº 18 da planilha v3 (Margem de escoamento),
-- não o nº 19 (Restrição tipo B). Erro de leitura de linha da planilha (linha 19 = parâmetro nº 18).
update ahp_subcriteria set trial = (name = 'Margem de escoamento (múltiplo)')
 where name in ('Margem de escoamento (múltiplo)', 'Restrição tipo B no barramento')
   and pillar_id in (select p.id from ahp_pillars p join ahp_models m on m.id = p.model_id where m.category = 'projeto');
