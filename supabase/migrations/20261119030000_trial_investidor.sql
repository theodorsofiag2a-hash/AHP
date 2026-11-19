-- Correção: na versão gratuita o modelo liberado é Projeto -> Investidor (não Equipamento de BESS).
update ahp_models set trial_available = (variant_label = 'Investidor')
 where category = 'projeto';
