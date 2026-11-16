/** Condição de uma faixa sobre um valor numérico (ex.: Ng do município). Chaves aceitas: gt, gte, lt, lte, eq. */
export type AutoMatch = { gt?: number; gte?: number; lt?: number; lte?: number; eq?: number };

const KEYS = ["gt", "gte", "lt", "lte", "eq"] as const;

export function matchesAuto(value: number, match: unknown): boolean {
  if (!match || typeof match !== "object" || Array.isArray(match)) return false;
  const m = match as Record<string, unknown>;
  const present = KEYS.filter((k) => m[k] !== undefined);
  if (present.length === 0) return false;
  for (const k of present) {
    const limit = m[k];
    if (typeof limit !== "number" || !Number.isFinite(limit)) return false;
    if (k === "gt" && !(value > limit)) return false;
    if (k === "gte" && !(value >= limit)) return false;
    if (k === "lt" && !(value < limit)) return false;
    if (k === "lte" && !(value <= limit)) return false;
    if (k === "eq" && value !== limit) return false;
  }
  return true;
}

/** Primeira faixa cuja condição vale para o valor; null se nenhuma (ou se a faixa não tem condição). */
export function pickScale<T extends { auto_match: unknown }>(value: number, scales: T[]): T | null {
  return scales.find((s) => matchesAuto(value, s.auto_match)) ?? null;
}
