import { GRID_NOTES } from "./notes";
import type { GridBus } from "./types";

export type ViabilityStatus = "inviable" | "attention" | "ok";

export interface ViabilityIssue {
  severity: "inviable" | "attention";
  text: string;
}

export interface Viability {
  status: ViabilityStatus;
  issues: ViabilityIssue[];
  /** Menor entre as margens de barramento, sub-área e área (os limites valem em conjunto, não se somam). */
  effectiveMarginMw: number;
}

/**
 * Os limites de subárea e área da NT valem em conjunto e não se somam; o que cabe de fato
 * é o menor dos três. É uma leitura da tabela ainda a confirmar com a NT do ONS.
 */
export function effectiveMargin(bus: GridBus): number {
  return Math.min(bus.busMarginMw, bus.subareaMarginMw, bus.areaMarginMw);
}

const formatMw = (value: number) => `${value.toLocaleString("pt-BR")} MW`;

/**
 * Inviável ("fatal flow"): sem margem, sem possibilidade física (classe B) ou potência
 * acima da margem efetiva. Atenção: qualquer restrição que não elimina o projeto sozinha.
 */
export function assessViability(bus: GridBus, powerMw?: number | null): Viability {
  const issues: ViabilityIssue[] = [];
  const effective = effectiveMargin(bus);

  if (bus.busMarginMw === 0) {
    issues.push({ severity: "inviable", text: "Sem margem de escoamento neste barramento (0 MW)." });
  } else if (powerMw != null && powerMw > effective) {
    issues.push({
      severity: "inviable",
      text: `A potência do projeto (${formatMw(powerMw)}) excede a margem efetiva (${formatMw(effective)}).`,
    });
  }

  if (bus.physicalClass === "B") {
    issues.push({
      severity: "inviable",
      text: "Sem possibilidade física de nova conexão na subestação (classe B da Tabela 5-1).",
    });
  }

  if (bus.busMarginMw > 0 && effective < bus.busMarginMw) {
    issues.push({
      severity: "attention",
      text: `O limite de sub-área/área (${formatMw(effective)}) é menor que a margem do barramento (${formatMw(bus.busMarginMw)}).`,
    });
  }

  if (bus.physicalClass === null) {
    issues.push({
      severity: "attention",
      text: "Fora da Tabela 5-1 (barramento virtual ou seccionamento): viabilidade física não classificada.",
    });
  }

  for (const note of bus.notes) {
    const text = GRID_NOTES[note];
    if (text) issues.push({ severity: "attention", text: `Nota ${note}: ${text}` });
  }

  const status: ViabilityStatus = issues.some((i) => i.severity === "inviable")
    ? "inviable"
    : issues.length > 0
      ? "attention"
      : "ok";

  return { status, issues, effectiveMarginMw: effective };
}
