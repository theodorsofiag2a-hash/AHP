-- Correções de faixas da planilha v3, combinadas com a G2A em 19/11/2026.
-- Atualiza as faixas existentes no lugar (mesmo id e mesmo percentual), para não invalidar fichas já preenchidas.

do $$
declare
  m record;
  s uuid;
begin
  for m in select id from ahp_models where category = 'projeto' loop

    -- 1. Número de contêineres: faixas sem sobreposição (menos contêineres é melhor).
    select sc.id into s from ahp_subcriteria sc join ahp_pillars p on p.id = sc.pillar_id
     where p.model_id = m.id and sc.name = 'Número de contêineres';
    if s is not null then
      update ahp_scales set description = 'Até 10 contêineres', sort_order = 0 where subcriterion_id = s and fulfillment_pct = 100;
      update ahp_scales set description = 'De 11 a 20 contêineres', sort_order = 1 where subcriterion_id = s and fulfillment_pct = 50;
      update ahp_scales set description = 'Mais de 20 contêineres', sort_order = 2 where subcriterion_id = s and fulfillment_pct = 0;
    end if;

    -- 2. Tensão: 138 kV entra em "até 138"; 345 kV = 30%; 440 kV ou mais (440, 500, 525) = 20%.
    select sc.id into s from ahp_subcriteria sc join ahp_pillars p on p.id = sc.pillar_id
     where p.model_id = m.id and sc.name = 'Tensão';
    if s is null then raise exception 'modelo % sem o subcritério Tensão', m.id; end if;
    update ahp_scales set description = 'Até 138 kV', sort_order = 0, auto_match = '{"lte": 138}' where subcriterion_id = s and fulfillment_pct = 100;
    update ahp_scales set description = '230 kV', sort_order = 1, auto_match = '{"eq": 230}' where subcriterion_id = s and fulfillment_pct = 50;
    update ahp_scales set description = '440 kV ou mais', sort_order = 3, auto_match = '{"gte": 440}' where subcriterion_id = s and fulfillment_pct = 20;
    insert into ahp_scales (subcriterion_id, description, fulfillment_pct, sort_order, auto_match)
      values (s, '345 kV', 30, 2, '{"eq": 345}');

    -- 3. CAPEX: a unidade é MW; acima de R$ 160 MM/MW = 0%.
    select sc.id into s from ahp_subcriteria sc join ahp_pillars p on p.id = sc.pillar_id
     where p.model_id = m.id and sc.name = 'CAPEX por MWh';
    if s is not null then
      update ahp_subcriteria set name = 'CAPEX por MW' where id = s;
      insert into ahp_scales (subcriterion_id, description, fulfillment_pct, sort_order)
        values (s, 'Acima de R$ 160 MM/MW', 0, 2);
    end if;

    -- 9. Nome igual ao da planilha.
    update ahp_subcriteria set name = 'Risco de habilitação do fabricante (código CFI/BNDES)'
     where name = 'Risco de habilitação do fabricante selecionado (código CFI/BNDES)'
       and pillar_id in (select id from ahp_pillars where model_id = m.id);

    -- 10a. Topografia: sem lacuna entre 3% e 3,1%.
    select sc.id into s from ahp_subcriteria sc join ahp_pillars p on p.id = sc.pillar_id
     where p.model_id = m.id and sc.name = 'Topografia';
    update ahp_scales set description = 'Alta: acima de 3%' where subcriterion_id = s and description = 'Alta: acima de 3,1%';

    -- 10b. Receita fixa / conteúdo interno: faixa para os valores acima do último limite.
    select sc.id into s from ahp_subcriteria sc join ahp_pillars p on p.id = sc.pillar_id
     where p.model_id = m.id and sc.name = 'Receita fixa / TIR de 15% do acionista';
    if s is not null then
      update ahp_scales set sort_order = case description
          when 'Receita fixa: até R$ 1.700/MW-mês' then 0
          when 'Receita fixa: até R$ 1.800/MW-mês' then 1
          when 'Receita fixa: até R$ 1.900/MW-mês' then 2
          when 'Conteúdo interno: até R$ 1.200' then 4
          when 'Conteúdo interno: até R$ 1.400' then 5
          when 'Conteúdo interno: até R$ 1.500' then 6
          else sort_order end
       where subcriterion_id = s;
      insert into ahp_scales (subcriterion_id, description, fulfillment_pct, sort_order) values
        (s, 'Receita fixa: acima de R$ 1.900/MW-mês', 0, 3),
        (s, 'Conteúdo interno: acima de R$ 1.500', 0, 7);
    end if;

    -- 10c. Tempo de arrendamento: faixas contínuas.
    select sc.id into s from ahp_subcriteria sc join ahp_pillars p on p.id = sc.pillar_id
     where p.model_id = m.id and sc.name = 'Tempo de arrendamento';
    update ahp_scales set description = 'Até 7 anos', sort_order = 0 where subcriterion_id = s and description = '7 anos';
    update ahp_scales set description = 'De 8 a 15 anos', sort_order = 1 where subcriterion_id = s and description = '15 anos';
    update ahp_scales set description = 'Mais de 15 anos', sort_order = 2 where subcriterion_id = s and description = '20 anos';
  end loop;
end $$;
