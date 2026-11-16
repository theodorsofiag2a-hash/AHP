/**
 * Projetos eliminados: os que escolheram, na ficha, uma faixa marcada como eliminatória.
 * Retorna alternativa -> nomes dos critérios que a eliminaram (sem repetir).
 */
export function findEliminated(
  scores: { alternative_id: string; subcriterion_id: string; scale_id: string }[],
  eliminatingScaleIds: Set<string>,
  subcriterionName: Map<string, string>
): Map<string, string[]> {
  const reasons = new Map<string, string[]>();
  for (const row of scores) {
    if (!eliminatingScaleIds.has(row.scale_id)) continue;
    const name = subcriterionName.get(row.subcriterion_id) ?? "Critério eliminatório";
    const list = reasons.get(row.alternative_id) ?? [];
    if (!list.includes(name)) list.push(name);
    reasons.set(row.alternative_id, list);
  }
  return reasons;
}
