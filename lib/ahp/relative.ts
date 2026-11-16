/** Valor do subcritério em `ahp_subcriteria.score_mode` para a nota relativa à carteira (menor é melhor). */
export const RELATIVE_LOWER = "relative_lower";

/**
 * Nota dinâmica relativa: o menor valor da carteira recebe 100, o maior recebe 0 e os demais
 * ficam em interpolação linear entre os dois. Com um só projeto, ou valores todos iguais,
 * ninguém é pior que ninguém: todos recebem 100.
 */
export function relativeLowerScores(values: Record<string, number>): Record<string, number> {
  const ids = Object.keys(values);
  if (ids.length === 0) return {};
  const nums = ids.map((id) => values[id]);
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  return Object.fromEntries(
    ids.map((id) => [id, max === min ? 100 : ((max - values[id]) / (max - min)) * 100])
  );
}

interface ScaleScoreRow {
  alternative_id: string;
  subcriterion_id: string;
  score_value: number | string;
}

interface ValueRow {
  alternative_id: string;
  subcriterion_id: string;
  raw_value: number | string;
}

/**
 * Junta as notas de faixa (já gravadas na ficha) com as notas relativas, calculadas aqui entre
 * as alternativas informadas. Retorna alternativa -> (subcritério -> nota 0-100).
 */
export function buildAlternativeScores(
  alternativeIds: string[],
  scaleScores: ScaleScoreRow[],
  values: ValueRow[]
): Record<string, Record<string, number>> {
  const result: Record<string, Record<string, number>> = Object.fromEntries(alternativeIds.map((id) => [id, {}]));
  for (const row of scaleScores) {
    if (result[row.alternative_id]) result[row.alternative_id][row.subcriterion_id] = Number(row.score_value);
  }

  const bySubcriterion = new Map<string, Record<string, number>>();
  for (const row of values) {
    if (!result[row.alternative_id]) continue;
    const entry = bySubcriterion.get(row.subcriterion_id) ?? {};
    entry[row.alternative_id] = Number(row.raw_value);
    bySubcriterion.set(row.subcriterion_id, entry);
  }
  for (const [subcriterionId, byAlternative] of bySubcriterion) {
    const scores = relativeLowerScores(byAlternative);
    for (const [alternativeId, score] of Object.entries(scores)) {
      result[alternativeId][subcriterionId] = score;
    }
  }
  return result;
}

/**
 * Lê um número digitado no formato brasileiro ("1.234,56", "17,5") ou simples ("17.5").
 * Retorna null se estiver vazio, não for número ou for negativo.
 */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const normalized = trimmed.includes(",") ? trimmed.replace(/\./g, "").replace(",", ".") : trimmed;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Texto para o campo: usa vírgula como separador decimal. */
export function formatDecimal(value: number): string {
  return String(value).replace(".", ",");
}
