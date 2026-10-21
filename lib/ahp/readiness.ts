export const MIN_ALTERNATIVES_TO_RUN = 2;

export interface AlternativeProgress {
  id: string;
  name: string;
  answered: number;
  total: number;
}

/** Quantos subcritérios cada alternativa já tem avaliados (nota salva) — base para liberar a execução. */
export function alternativeProgress(
  subcriterionIds: string[],
  alternatives: { id: string; name: string }[],
  scores: { alternative_id: string; subcriterion_id: string }[]
): AlternativeProgress[] {
  const valid = new Set(subcriterionIds);
  return alternatives.map((alt) => ({
    id: alt.id,
    name: alt.name,
    answered: new Set(
      scores.filter((s) => s.alternative_id === alt.id && valid.has(s.subcriterion_id)).map((s) => s.subcriterion_id)
    ).size,
    total: subcriterionIds.length,
  }));
}

export function incompleteAlternatives(progress: AlternativeProgress[]): AlternativeProgress[] {
  return progress.filter((p) => p.answered < p.total);
}
