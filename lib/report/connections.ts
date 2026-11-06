import type { SupabaseClient } from "@supabase/supabase-js";
import { GRID_BUS_COLUMNS, toGridBus, type GridBus, type GridBusRow } from "../grid/types";
import { assessViability, effectiveMargin } from "../grid/viability";
import { formatNumber } from "./format";

/** Observação de conexão de cada projeto (barramento da NT-ONS + viabilidade). Isolado aqui por depender da Conexão. */
export interface ReportConnection {
  note: string;
  /** Motivo que torna a conexão inviável (vira risco do projeto), se houver. */
  inviable: string | null;
}

export function describeConnection(bus: GridBus | null, powerMw: number | null): ReportConnection {
  if (!bus) return { note: "Barramento não informado na AHP.", inviable: null };
  const assessment = assessViability(bus, powerMw);
  const label =
    assessment.status === "ok"
      ? "conexão sem restrições"
      : assessment.status === "attention"
        ? "conexão com pontos de atenção"
        : "conexão inviável";
  const power = powerMw != null ? `; potência ${formatNumber(powerMw, 0)} MW` : "";
  const note = `${bus.name} (${bus.uf}, ${bus.kv} kV); margem efetiva ${formatNumber(effectiveMargin(bus), 0)} MW${power}; ${label}.`;
  const inviableIssue = assessment.issues.find((i) => i.severity === "inviable");
  return { note, inviable: inviableIssue ? inviableIssue.text : null };
}

export async function loadConnections(
  supabase: SupabaseClient,
  alternativeIds: string[]
): Promise<Map<string, ReportConnection>> {
  const result = new Map<string, ReportConnection>();
  const { data: alts } = await supabase.from("ahp_alternatives").select("id, power_mw, bus_id").in("id", alternativeIds);
  const rows = (alts ?? []) as { id: string; power_mw: number | string | null; bus_id: string | null }[];
  const busIds = Array.from(new Set(rows.map((a) => a.bus_id).filter((id): id is string => !!id)));
  const { data: busRows } = busIds.length
    ? await supabase.from("grid_buses").select(GRID_BUS_COLUMNS).in("id", busIds)
    : { data: [] };
  const busById = new Map(((busRows ?? []) as GridBusRow[]).map((r) => [r.id, toGridBus(r)]));
  for (const a of rows) {
    const power = a.power_mw != null ? Number(a.power_mw) : null;
    result.set(a.id, describeConnection(a.bus_id ? (busById.get(a.bus_id) ?? null) : null, power));
  }
  return result;
}
