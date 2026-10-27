import { z } from "zod";

/** Barramento candidato do LRCAP Armazenamento 2026 (tabela `grid_buses`). */
export interface GridBus {
  id: string;
  uf: string;
  name: string;
  kv: number;
  busMarginMw: number;
  subareaMarginMw: number;
  areaMarginMw: number;
  subareaExpr: string | null;
  areaExpr: string | null;
  /** Notas 1 a 7 da Tabela 4-1 da NT-ONS. */
  notes: number[];
  /** A = possibilidade de novas conexões; B = sem possibilidade; null = fora da Tabela 5-1. */
  physicalClass: "A" | "B" | null;
  bonified: boolean;
  tustG: number | null;
  tusdG: number | null;
  transmissora: string | null;
}

/** Colunas lidas de `grid_buses` (mantém a query e o mapeamento em sincronia). */
export const GRID_BUS_COLUMNS =
  "id, uf, name, kv, bus_margin_mw, subarea_margin_mw, area_margin_mw, subarea_expr, area_expr, notes, physical_class, bonified, tust_g, tusd_g, transmissora";

export interface GridBusRow {
  id: string;
  uf: string;
  name: string;
  kv: number;
  bus_margin_mw: number | string;
  subarea_margin_mw: number | string;
  area_margin_mw: number | string;
  subarea_expr: string | null;
  area_expr: string | null;
  notes: number[] | null;
  physical_class: string | null;
  bonified: boolean;
  tust_g: number | string | null;
  tusd_g: number | string | null;
  transmissora: string | null;
}

const toNumberOrNull = (value: number | string | null): number | null => (value == null ? null : Number(value));

export function toGridBus(row: GridBusRow): GridBus {
  return {
    id: row.id,
    uf: row.uf,
    name: row.name,
    kv: row.kv,
    busMarginMw: Number(row.bus_margin_mw),
    subareaMarginMw: Number(row.subarea_margin_mw),
    areaMarginMw: Number(row.area_margin_mw),
    subareaExpr: row.subarea_expr,
    areaExpr: row.area_expr,
    notes: row.notes ?? [],
    physicalClass: row.physical_class === "A" || row.physical_class === "B" ? row.physical_class : null,
    bonified: row.bonified,
    tustG: toNumberOrNull(row.tust_g),
    tusdG: toNumberOrNull(row.tusd_g),
    transmissora: row.transmissora,
  };
}

/** Atributo do barramento que alimenta um subcritério (coluna `ahp_subcriteria.auto_field`). */
export const AUTO_FIELDS = ["tariff_g", "kv", "bonified", "is_sectioning"] as const;
export type AutoField = (typeof AUTO_FIELDS)[number];

export function parseAutoField(value: unknown): AutoField | null {
  return typeof value === "string" && (AUTO_FIELDS as readonly string[]).includes(value) ? (value as AutoField) : null;
}

/**
 * Condição de uma escala sobre o atributo (coluna `ahp_scales.auto_match`). Todas as chaves
 * presentes precisam ser verdadeiras. `eq` serve para número ou booleano.
 */
const autoMatchSchema = z
  .object({
    gt: z.number().optional(),
    gte: z.number().optional(),
    lt: z.number().optional(),
    lte: z.number().optional(),
    eq: z.union([z.number(), z.boolean()]).optional(),
  })
  .strict();

export type AutoMatch = z.infer<typeof autoMatchSchema>;

/** Regra inválida ou ausente vira null: a escala simplesmente não participa do preenchimento. */
export function parseAutoMatch(value: unknown): AutoMatch | null {
  const parsed = autoMatchSchema.safeParse(value);
  if (!parsed.success || Object.keys(parsed.data).length === 0) return null;
  return parsed.data;
}
