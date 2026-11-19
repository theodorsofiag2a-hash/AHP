-- Versão gratuita (trial): só o modelo Projeto -> Equipamento de BESS fica liberado.
-- Fornecedor e Projeto -> Investidor aparecem bloqueados até a contratação.
alter table ahp_models add column trial_available boolean not null default false;

update ahp_models set trial_available = true
 where category = 'projeto' and variant_label = 'Equipamento de BESS';
