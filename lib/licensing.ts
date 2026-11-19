/** Ritos de licenciamento (`licensing_rules.rite`) e o texto de cada um. */
export const RITES = ["dispensa", "simplificado", "trifasico", "em_elaboracao", "em_consulta", "nao_informado"] as const;
export type Rite = (typeof RITES)[number];

export const RITE_LABEL: Record<Rite, string> = {
  dispensa: "Dispensa",
  simplificado: "Simplificado",
  trifasico: "Trifásico",
  em_elaboracao: "Em elaboração",
  em_consulta: "Em consulta",
  nao_informado: "Não informado",
};

export function isRite(value: unknown): value is Rite {
  return typeof value === "string" && (RITES as readonly string[]).includes(value);
}

/** Rito ainda indefinido na UF: a pontuação preenchida é provisória e pede revisão/ajuste. */
export function isProvisionalRite(rite: Rite): boolean {
  return rite === "em_consulta" || rite === "em_elaboracao" || rite === "nao_informado";
}

/** Faixa de complexidade que corresponde ao rito (pela chave `ahp_scales.auto_key`). */
export function pickScaleByKey<T extends { auto_key: string | null }>(rite: Rite, scales: T[]): T | null {
  return scales.find((s) => s.auto_key === rite) ?? null;
}
