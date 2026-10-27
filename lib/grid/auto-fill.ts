import { SECTIONING_NOTE } from "./notes";
import type { AutoField, AutoMatch, GridBus } from "./types";

export type AutoValue = number | boolean | null;

/** Valor do barramento para cada atributo que pode alimentar um subcritério. */
export function busAutoValue(bus: GridBus, field: AutoField): AutoValue {
  switch (field) {
    case "tariff_g":
      // TUST (transmissão, a partir de 230 kV) e TUSDg (distribuição) nunca coexistem na base.
      return bus.tustG ?? bus.tusdG;
    case "kv":
      return bus.kv;
    case "bonified":
      return bus.bonified;
    case "is_sectioning":
      return bus.notes.includes(SECTIONING_NOTE);
  }
}

export function matchesRule(value: AutoValue, rule: AutoMatch): boolean {
  if (value === null) return false;
  if (rule.eq !== undefined && value !== rule.eq) return false;

  const hasBound = rule.gt !== undefined || rule.gte !== undefined || rule.lt !== undefined || rule.lte !== undefined;
  if (hasBound) {
    if (typeof value !== "number") return false;
    if (rule.gt !== undefined && !(value > rule.gt)) return false;
    if (rule.gte !== undefined && !(value >= rule.gte)) return false;
    if (rule.lt !== undefined && !(value < rule.lt)) return false;
    if (rule.lte !== undefined && !(value <= rule.lte)) return false;
  }
  return true;
}

export interface AutoSubcriterion {
  id: string;
  name: string;
  autoField: AutoField;
  scales: { id: string; autoMatch: AutoMatch | null }[];
}

export type AutoFillMiss = "no_data" | "no_scale" | "ambiguous";

export interface AutoFillResult {
  /** subcriterionId -> scaleId escolhida pelo barramento. */
  selections: Record<string, string>;
  /** Subcritérios que o barramento não conseguiu responder, com o motivo. */
  misses: { subcriterionId: string; name: string; reason: AutoFillMiss }[];
}

/**
 * Só preenche quando exatamente UMA escala casa com o valor: sem dado, sem escala
 * correspondente ou escalas ambíguas ficam para o usuário escolher manualmente.
 */
export function computeAutoFill(bus: GridBus, subcriteria: AutoSubcriterion[]): AutoFillResult {
  const selections: Record<string, string> = {};
  const misses: AutoFillResult["misses"] = [];

  for (const sub of subcriteria) {
    const value = busAutoValue(bus, sub.autoField);
    if (value === null) {
      misses.push({ subcriterionId: sub.id, name: sub.name, reason: "no_data" });
      continue;
    }
    const matching = sub.scales.filter((scale) => scale.autoMatch && matchesRule(value, scale.autoMatch));
    if (matching.length === 1) selections[sub.id] = matching[0].id;
    else misses.push({ subcriterionId: sub.id, name: sub.name, reason: matching.length === 0 ? "no_scale" : "ambiguous" });
  }

  return { selections, misses };
}
