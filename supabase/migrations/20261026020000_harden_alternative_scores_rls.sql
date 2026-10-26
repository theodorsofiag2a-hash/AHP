-- ============================================================================
-- Correção de segurança (auditoria 2026-10-26, docs/SECURITY_AUDIT.md, achado S6):
-- a policy de ahp_alternative_scores só conferia que a ALTERNATIVA pertence à
-- organização do usuário. Não conferia que a ESCALA enviada pertence ao SUBCRITÉRIO
-- indicado, nem que esse subcritério pertence ao mesmo MODELO da alternativa. Isso dava
-- para gravar, via POST/PATCH direto no PostgREST (sem passar pela validação que já foi
-- adicionada em actions/alternatives.ts), a nota de uma escala de outro subcritério ou de
-- outro modelo como se fosse a resposta de um subcritério legítimo.
--
-- Confirmado dinamicamente antes desta correção: como membro de uma organização, inseri
-- uma linha em ahp_alternative_scores usando o scale_id de um subcritério diferente do
-- indicado em subcriterion_id — aceito sem erro.
--
-- A correção em actions/alternatives.ts cobre o caminho normal do app (mensagem em
-- pt-BR, sem round-trip a mais); esta migration fecha o mesmo buraco para quem grava
-- direto via REST/RPC com uma sessão válida, que é como o problema foi encontrado.
-- ============================================================================

drop policy if exists ahp_alternative_scores_all on ahp_alternative_scores;

create policy ahp_alternative_scores_all on ahp_alternative_scores
  for all using (
    exists (
      select 1 from ahp_alternatives a
      join ahp_models m on m.id = a.model_id
      where a.id = ahp_alternative_scores.alternative_id and public.is_org_member(m.organization_id)
    )
  )
  with check (
    exists (
      select 1
      from ahp_alternatives a
      join ahp_models m on m.id = a.model_id
      join ahp_subcriteria s on s.id = ahp_alternative_scores.subcriterion_id and s.pillar_id in (
        select p.id from ahp_pillars p where p.model_id = a.model_id
      )
      join ahp_scales sc on sc.id = ahp_alternative_scores.scale_id and sc.subcriterion_id = s.id
      where a.id = ahp_alternative_scores.alternative_id
        and public.is_org_member(m.organization_id)
    )
  );
