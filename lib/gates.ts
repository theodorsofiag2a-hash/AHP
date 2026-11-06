/**
 * Filtros eliminatórios (go/no-go) do Premissário R1 / seção 11 do relatório.
 * Não são compensáveis por nota: reprovou em um, fica fora do ranking.
 * Valor: true = atende, false = não atende, null = pendente (não elimina, mas aparece como pendência).
 */
export const GATES = [
  {
    key: "rte",
    column: "gate_rte",
    label: "RTE mínima",
    requirement: "RTE ≥ 85% referenciada ao PMI ao longo do horizonte contratual (Portaria MME nº 136/2026)",
  },
  {
    key: "deadline",
    column: "gate_deadline",
    label: "Prazo de entrada em operação",
    requirement: "Compatível com a data-alvo de 01/08/2028 do LRCAP 2026",
  },
  {
    key: "auction",
    column: "gate_auction",
    label: "Conformidade do leilão",
    requirement: "Atende os requisitos do leilão SAE e, no Armazenamento Nacional, os de conteúdo local",
  },
  {
    key: "technical",
    column: "gate_technical",
    label: "Habilitação técnica",
    requirement: "Atende os requisitos para entrada em operação (resoluções ANEEL aplicáveis)",
  },
] as const;

export type GateKey = (typeof GATES)[number]["key"];
export type GateValues = Record<GateKey, boolean | null>;

// Literal (não calculado) para o parser de tipos do PostgREST aceitar em .select().
export const GATE_COLUMNS = "gate_rte, gate_deadline, gate_auction, gate_technical";

export const EMPTY_GATES: GateValues = { rte: null, deadline: null, auction: null, technical: null };

export interface GateRow {
  gate_rte?: boolean | null;
  gate_deadline?: boolean | null;
  gate_auction?: boolean | null;
  gate_technical?: boolean | null;
}

export function toGateValues(row: GateRow): GateValues {
  return {
    rte: row.gate_rte ?? null,
    deadline: row.gate_deadline ?? null,
    auction: row.gate_auction ?? null,
    technical: row.gate_technical ?? null,
  };
}

export interface GateAssessment {
  /** eliminated: algum filtro não atendido; pending: nenhum reprovado, mas há filtro sem resposta; passed: todos atendidos. */
  status: "eliminated" | "pending" | "passed";
  failed: GateKey[];
  pending: GateKey[];
}

export function assessGates(values: GateValues): GateAssessment {
  const failed = GATES.filter((g) => values[g.key] === false).map((g) => g.key);
  const pending = GATES.filter((g) => values[g.key] === null).map((g) => g.key);
  return {
    status: failed.length > 0 ? "eliminated" : pending.length > 0 ? "pending" : "passed",
    failed,
    pending,
  };
}

export function isEliminated(row: GateRow): boolean {
  return assessGates(toGateValues(row)).status === "eliminated";
}
