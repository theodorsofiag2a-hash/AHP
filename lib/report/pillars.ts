/**
 * O modelo de relatório (Premissário) tem 4 pilares; a AHP pode ter 5 (Implantação e Sócio Ambiental
 * separados). Aqui os pilares da AHP são agrupados nos 4 do relatório sem alterar a AHP: pesos e pontos somam,
 * e o desempenho do grupo é a média dos pilares ponderada pelo peso.
 */
export const REPORT_PILLARS = [
  { key: "financeiro", name: "Financeiro e Comercial" },
  { key: "engenharia", name: "Engenharia e Sítio" },
  { key: "conexao", name: "Conexão e Acesso à Rede" },
  { key: "implantacao", name: "Implantação, Prazo e Socioambiental" },
] as const;

export type ReportPillarKey = (typeof REPORT_PILLARS)[number]["key"];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** Em qual dos 4 pilares do relatório um pilar da AHP entra. O que não casa com nada vai para o 4º. */
export function reportPillarIndex(pillarName: string): number {
  const n = normalize(pillarName);
  if (n.includes("financ")) return 0;
  if (n.includes("engenh")) return 1;
  if (n.includes("conex")) return 2;
  return 3;
}

export interface GroupedPillar {
  index: number;
  key: ReportPillarKey;
  name: string;
  /** Ids dos pilares da AHP que formam este grupo. */
  pillarIds: string[];
  weight: number;
}

export function groupPillars(pillars: { id: string; name: string }[], weights: Record<string, number>): GroupedPillar[] {
  return REPORT_PILLARS.map((rp, index) => {
    const members = pillars.filter((p) => reportPillarIndex(p.name) === index);
    return {
      index,
      key: rp.key,
      name: rp.name,
      pillarIds: members.map((m) => m.id),
      weight: members.reduce((sum, m) => sum + (weights[m.id] ?? 0), 0),
    };
  });
}
