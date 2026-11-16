import { SECTIONING_NOTE } from "./notes";
import type { AutoField, AutoMatch, GridBus } from "./types";
import { effectiveMargin } from "./viability";

export type AutoValue = number | boolean | null;

/** Dados do projeto (além do barramento) que alguns atributos precisam. */
export interface AutoContext {
  /** Potência do projeto, em MW. */
  powerMw: number | null;
  /** MUST contratado, em MW. */
  mustMw: number | null;
}

const NO_CONTEXT: AutoContext = { powerMw: null, mustMw: null };

/** Valor do barramento (e do projeto, quando preciso) para cada atributo que pode alimentar um subcritério. */
export function busAutoValue(bus: GridBus, field: AutoField, context: AutoContext = NO_CONTEXT): AutoValue {
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
    case "bus_class_b":
      // Fora da Tabela 5-1 (classe desconhecida) não dá para afirmar: fica para o usuário.
      return bus.physicalClass === null ? null : bus.physicalClass === "B";
    case "margin_multiple":
      return context.powerMw != null && context.powerMw > 0 ? effectiveMargin(bus) / context.powerMw : null;
    case "eust":
      // TUST em R$/kW·mês × MUST em kW. Só TUST (a partir de 230 kV): sem ela, o valor é digitado.
      return bus.tustG != null && context.mustMw != null ? Math.round(bus.tustG * context.mustMw * 1000 * 100) / 100 : null;
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
  /** Subcritério relativo à carteira (EUST): recebe o valor calculado, não uma escala. */
  relative?: boolean;
  scales: { id: string; autoMatch: AutoMatch | null }[];
}

export type AutoFillMiss = "no_data" | "no_scale" | "ambiguous";

export interface AutoFillResult {
  /** subcriterionId -> scaleId escolhida pelo barramento. */
  selections: Record<string, string>;
  /** subcriterionId -> valor calculado, para os subcritérios relativos (EUST). */
  values: Record<string, number>;
  /** Subcritérios que o barramento não conseguiu responder, com o motivo. */
  misses: { subcriterionId: string; name: string; reason: AutoFillMiss }[];
}

/**
 * Só preenche quando exatamente UMA escala casa com o valor: sem dado, sem escala
 * correspondente ou escalas ambíguas ficam para o usuário escolher manualmente.
 */
export function computeAutoFill(
  bus: GridBus,
  subcriteria: AutoSubcriterion[],
  context: AutoContext = NO_CONTEXT
): AutoFillResult {
  const selections: Record<string, string> = {};
  const values: Record<string, number> = {};
  const misses: AutoFillResult["misses"] = [];

  for (const sub of subcriteria) {
    const value = busAutoValue(bus, sub.autoField, context);
    if (value === null) {
      misses.push({ subcriterionId: sub.id, name: sub.name, reason: "no_data" });
      continue;
    }
    if (sub.relative) {
      if (typeof value === "number") values[sub.id] = value;
      else misses.push({ subcriterionId: sub.id, name: sub.name, reason: "no_data" });
      continue;
    }
    const matching = sub.scales.filter((scale) => scale.autoMatch && matchesRule(value, scale.autoMatch));
    if (matching.length === 1) selections[sub.id] = matching[0].id;
    else misses.push({ subcriterionId: sub.id, name: sub.name, reason: matching.length === 0 ? "no_scale" : "ambiguous" });
  }

  return { selections, values, misses };
}
