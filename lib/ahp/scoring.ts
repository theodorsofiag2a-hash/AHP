/** Valor de `ahp_subcriteria.score_mode` do parâmetro de triagem: informa, mas não pontua. */
export const SCREENING = "screening";

export interface SubcriterionFlags {
  score_mode: string;
  trial?: boolean | null;
}

/**
 * O subcritério entra na nota? A triagem nunca entra. Na versão trial, só os parâmetros marcados
 * como trial. O peso dos que ficam de fora não conta no pilar (a nota do pilar é normalizada
 * pelos pesos que pontuam), então o máximo continua sendo 100%.
 */
export function isScoring(sub: SubcriterionFlags, trial: boolean): boolean {
  if (sub.score_mode === SCREENING) return false;
  return !trial || sub.trial === true;
}

/** Na versão trial, o parâmetro fora da lista fica bloqueado (visível, mas borrado na ficha). */
export function isLocked(sub: SubcriterionFlags, trial: boolean): boolean {
  return trial && sub.trial !== true && sub.score_mode !== SCREENING;
}
