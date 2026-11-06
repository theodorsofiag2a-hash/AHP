import { formatDateBr, formatMonthYear, formatNumber, formatPercent, joinList, normalizeKey } from "./format";
import { groupPillars, type GroupedPillar } from "./pillars";
import { runSensitivity } from "./sensitivity";
import { simpleTableXml } from "./xml-tables";

/** Tudo que o relatório precisa de uma execução. Montado no servidor a partir do banco (ver o route handler). */
export interface ReportInput {
  orgName: string;
  modelName: string;
  runDate: Date;
  consistencyRatio: number;
  pillars: { id: string; name: string }[];
  /** Peso (0–1) de cada pilar da AHP nesta execução. */
  pillarWeights: Record<string, number>;
  /** Comparações pareadas (valor de Saaty de A sobre B) da execução. */
  pillarComparisons: { pillarAId: string; pillarBId: string; saatyValue: number }[];
  subcriteria: {
    id: string;
    pillarId: string;
    name: string;
    weightPct: number;
    scales: { description: string }[];
  }[];
  results: {
    alternativeId: string;
    name: string;
    rank: number;
    finalScore: number;
    pillarPoints: Record<string, number>;
    pillarRadar: Record<string, number>;
  }[];
  alternatives: {
    id: string;
    /** Observação de conexão (opcional; vem de connections.ts quando a Conexão existe). */
    connection?: { note: string; inviable: string | null } | null;
    selections: Record<string, { scaleDescription: string; score: number }>;
  }[];
  form: { clientName: string; responsible: string; documentNumber: string };
  /** Textos de "Definição" e "Leitura para a priorização" por critério (opcional; chave = nome normalizado). */
  criteriaTexts: Record<string, { definition?: string; reading?: string }>;
}

export interface ReportChartsData {
  weights: { name: string; weight: number }[];
  /** Desempenho 0–10 por pilar do relatório, para os 3 primeiros colocados. */
  radar: { axes: string[]; series: { name: string; values: number[] }[] };
  /** Pontos (base 100) por pilar do relatório, por projeto, na ordem do ranking. */
  composition: { pillars: string[]; rows: { name: string; points: number[] }[] };
}

const DASH = "—";
const MAX_GATE_COLUMNS = 8;

const PARTICIPATION = ["Maior peso da hierarquia", "Segundo maior peso", "Terceiro maior peso", "Menor peso"];

function bullet(items: string[]): string {
  return items.length === 0 ? DASH : items.map((i) => `• ${i}`).join("\n");
}

function matrixCell(value: number): string {
  if (Math.abs(value - 1) < 1e-9) return "1";
  if (value > 1) return Number.isInteger(value) ? String(value) : formatNumber(value, 2);
  const inv = 1 / value;
  return Number.isInteger(Math.round(inv * 1000) / 1000) ? `1/${Math.round(inv)}` : formatNumber(value, 2);
}

export function buildReportData(input: ReportInput): { data: Record<string, unknown>; charts: ReportChartsData } {
  const grouped = groupPillars(input.pillars, input.pillarWeights);
  const pillarName = new Map(input.pillars.map((p) => [p.id, p.name]));

  // Peso global (%) de cada critério = peso do pilar × peso relativo dentro do pilar.
  const totalByPillar = new Map<string, number>();
  for (const s of input.subcriteria) totalByPillar.set(s.pillarId, (totalByPillar.get(s.pillarId) ?? 0) + s.weightPct);
  const localWeight = (s: ReportInput["subcriteria"][number]) => s.weightPct / (totalByPillar.get(s.pillarId) || 1);
  const globalWeight = (s: ReportInput["subcriteria"][number]) => localWeight(s) * (input.pillarWeights[s.pillarId] ?? 0);

  const ranking = [...input.results].sort((a, b) => a.rank - b.rank);
  const altById = new Map(input.alternatives.map((a) => [a.id, a]));
  const nProjects = ranking.length;

  // ---- por projeto: pilar de maior contribuição, diferenciais, riscos, observações
  const rows = ranking.map((r) => {
    const alt = altById.get(r.alternativeId);
    const groupPoints = grouped.map((g) => g.pillarIds.reduce((sum, id) => sum + (r.pillarPoints[id] ?? 0), 0));
    const topIndex = groupPoints.indexOf(Math.max(...groupPoints));

    const scored = input.subcriteria
      .map((s) => ({ s, sel: alt?.selections[s.id] }))
      .filter((x): x is { s: ReportInput["subcriteria"][number]; sel: { scaleDescription: string; score: number } } => !!x.sel)
      .map(({ s, sel }) => ({ name: s.name, scale: sel.scaleDescription, score: sel.score, weight: globalWeight(s) }));

    const strengths = scored
      .filter((x) => x.score >= 75)
      .sort((a, b) => b.score * b.weight - a.score * a.weight)
      .slice(0, 3)
      .map((x) => `${x.name} — ${x.scale}`);
    const weaknesses = scored
      .filter((x) => x.score <= 25)
      .sort((a, b) => a.score - b.score || b.weight - a.weight)
      .slice(0, 3)
      .map((x) => `${x.name} — ${x.scale}`);

    const conn = alt?.connection ?? null;
    if (conn?.inviable) weaknesses.unshift(`Conexão: ${conn.inviable}`);

    return {
      rank: r.rank,
      name: r.name,
      score: r.finalScore / 10,
      topPillar: grouped[topIndex].name,
      strengths,
      weaknesses,
      note: conn?.note ?? DASH,
      groupPoints,
      groupPerformance: grouped.map((g) => {
        // Desempenho do grupo (0–1) = Σ(desempenho × peso)/peso do grupo; usa o radar (0–10) de cada pilar da AHP.
        if (g.weight <= 0) return 0;
        const sum = g.pillarIds.reduce((acc, id) => acc + ((r.pillarRadar[id] ?? 0) / 10) * (input.pillarWeights[id] ?? 0), 0);
        return sum / g.weight;
      }),
    };
  });

  const weightsByRank = [...grouped].sort((a, b) => b.weight - a.weight);
  const participation = new Map(weightsByRank.map((g, i) => [g.index, PARTICIPATION[i] ?? ""]));

  const pesosInline = joinList(grouped.map((g) => `${g.name} (${formatPercent(g.weight)})`));
  const crOk = input.consistencyRatio <= 0.1;
  const crText = `${formatNumber(input.consistencyRatio, 3)} (${crOk ? "dentro do limite de 0,10" : "acima do limite de 0,10 — revisar os julgamentos"})`;

  // ---- seção 10: critérios por pilar do relatório
  const criteriaFor = (g: GroupedPillar) =>
    input.subcriteria
      .filter((s) => g.pillarIds.includes(s.pillarId))
      .map((s) => {
        const texts = input.criteriaTexts[normalizeKey(s.name)] ?? {};
        return {
          criterio: s.name,
          definicao: texts.definition ?? DASH,
          escala: bullet(s.scales.map((sc) => sc.description)),
          peso: formatPercent(globalWeight(s), 2),
          leitura: texts.reading ?? DASH,
        };
      });
  const nCriteria = input.subcriteria.length;

  // ---- sensibilidade
  const sens = runSensitivity(
    grouped,
    rows.map((r) => ({ name: r.name, performance: r.groupPerformance }))
  );
  const orderText = (order: string[]) => order.join(" > ");
  const caseLines = (cases: typeof sens.conservative) =>
    cases.map((c) => `${c.label}: ${orderText(c.order)}${c.changed ? " (ordem muda)" : " (ordem mantida)"}`).join("\n");
  const changedCount = [...sens.conservative, ...sens.execution].filter((c) => c.changed).length;
  const sensConclusao =
    `Variações de ordem dentro da faixa testada indicam ranking robusto; inversões relevantes de posições exigem leitura conjunta dos pilares afetados antes da decisão de estruturação. ` +
    (changedCount === 0
      ? "Resultado desta rodada: a ordem dos projetos foi mantida em todos os cenários testados (ranking robusto)."
      : `Resultado desta rodada: a ordem mudou em ${changedCount} de 4 variações testadas; ver a Tabela 12.1.`);

  // ---- textos do sumário e das conclusões
  const leader = rows[0];
  const leaderStrengths = leader ? (leader.strengths.length ? joinList(leader.strengths.map((s) => s.split(" — ")[0])) : "nenhum critério com desempenho muito alto") : DASH;
  const leaderWeaknesses = leader ? (leader.weaknesses.length ? joinList(leader.weaknesses.map((s) => s.split(" — ")[0])) : "nenhum critério com desempenho muito baixo") : DASH;
  const top5 = rows
    .slice(0, 5)
    .map((r) => `${r.rank}º ${r.name} (${formatNumber(r.score, 1)})`)
    .join("; ");
  const resumoRanking = leader
    ? `Quanto ao resultado, o modelo indica o ranking consolidado apresentado na Seção 8: ${top5}${nProjects > 5 ? "; demais projetos na Tabela 8.1" : ""}. Notas na escala de 0 a 100; razão de consistência (CR) da rodada: ${crText}.`
    : DASH;
  const resumoDiferenciais = leader
    ? `A priorização recomenda atenção ao projeto líder (${leader.name}), cujos diferenciais competitivos são: ${leaderStrengths}; e aos pontos de atenção: ${leaderWeaknesses}. Os demais riscos por projeto estão na Tabela 8.1.`
    : DASH;

  const concA = leader
    ? `O modelo indica ${leader.name} como prioridade (nota ${formatNumber(leader.score, 1)} de 100)${rows[1] ? `, seguido por ${joinList(rows.slice(1, 3).map((r) => `${r.name} (${formatNumber(r.score, 1)})`))}` : ""}. Foram ordenados ${nProjects} projetos, conforme a nota ponderada da Seção 8 e a distribuição de pesos da Seção 9. CR da rodada: ${crText}.`
    : DASH;
  const concB = leader ? `Diferenciais de ${leader.name}: ${bullet(leader.strengths).replace(/\n/g, " ")}` : DASH;
  const concC = leader ? `Pontos de atenção de ${leader.name}: ${bullet(leader.weaknesses).replace(/\n/g, " ")}. Conexão: ${leader.note}` : DASH;

  const pesosTexto = grouped.map((g, i) => `Pilar ${i + 1} — ${g.name}: ${formatPercent(g.weight)}`).join("; ");
  const maiorPeso = weightsByRank[0];
  const pesosLeitura = `Os pesos refletem as comparações pareadas desta rodada. CR: ${crText}. O pilar de maior peso é ${maiorPeso.name} (${formatPercent(maiorPeso.weight)}), seguido por ${joinList(weightsByRank.slice(1).map((g) => `${g.name} (${formatPercent(g.weight)})`))}.`;

  // ---- anexo A: pesos locais (A.1–A.4) e matriz entre pilares (A.5)
  const annexCriteria = grouped.map((g) => {
    const list = input.subcriteria.filter((s) => g.pillarIds.includes(s.pillarId));
    const multi = g.pillarIds.length > 1;
    return {
      count: list.length,
      xml: simpleTableXml(
        ["Critério", "Peso local no pilar (%)"],
        list.map((s) => [multi ? `${s.name} (${pillarName.get(s.pillarId)})` : s.name, formatNumber(localWeight(s) * 100, 2)]),
        [6600, 2800]
      ),
    };
  });

  const n = input.pillars.length;
  const index = new Map(input.pillars.map((p, i) => [p.id, i]));
  const matrix: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
  for (const c of input.pillarComparisons) {
    const i = index.get(c.pillarAId);
    const j = index.get(c.pillarBId);
    if (i == null || j == null) continue;
    matrix[i][j] = c.saatyValue;
    matrix[j][i] = 1 / c.saatyValue;
  }
  const a5Widths = [2600, ...Array(n).fill(Math.floor(5800 / n)), 1000];
  const a5Xml = simpleTableXml(
    ["Pilar", ...input.pillars.map((p) => p.name), "Peso local (%)"],
    input.pillars.map((p, i) => [p.name, ...matrix[i].map(matrixCell), formatNumber((input.pillarWeights[p.id] ?? 0) * 100, 1)]),
    a5Widths
  );
  const consolidated = n > 4;

  const data: Record<string, unknown> = {
    cliente: input.form.clientName,
    responsavel: input.form.responsible,
    numero: input.form.documentNumber,
    data_mes: formatMonthYear(input.runDate),
    data_execucao: formatDateBr(input.runDate),
    nome_modelo: input.modelName,
    n_projetos: String(nProjects),
    n_criterios: String(nCriteria),
    cr: crText,
    pesos_inline: pesosInline,
    pesos_texto: pesosTexto,
    pesos_leitura: pesosLeitura,
    resumo_ranking: resumoRanking,
    resumo_diferenciais: resumoDiferenciais,
    ranking: rows.map((r) => ({
      posicao: `${r.rank}º`,
      projeto: r.name,
      nota: formatNumber(r.score, 1),
      pilar_top: r.topPillar,
      diferenciais: bullet(r.strengths),
      riscos: bullet(r.weaknesses),
      obs: r.note,
    })),
    conc_a: concA,
    conc_b: concB,
    conc_c: concC,
    sens_neutro: `Ordem: ${orderText(sens.neutral)}`,
    sens_conservador: caseLines(sens.conservative),
    sens_execucao: caseLines(sens.execution),
    sens_conclusao: sensConclusao,
    anexo_nota:
      "Nesta rodada os pesos locais dos critérios são definidos pela G2A no modelo e fixos; somente os pilares são comparados par a par. " +
      "Por isso as matrizes A.1 a A.4 são apresentadas como quadro de pesos locais, e a matriz A.5 traz os julgamentos efetivos da rodada." +
      (consolidated ? " Nas seções 8 a 12, os pilares Implantação e Sócio Ambiental aparecem consolidados no Pilar 4." : ""),
    a5_titulo: `A.5 — Matriz entre pilares (${n} × ${n})`,
    a5_cr: `CR: ${crText}`,
    a5_xml: a5Xml,
  };

  grouped.forEach((g, i) => {
    const k = i + 1;
    data[`p${k}_nome`] = g.name;
    data[`p${k}_peso`] = formatPercent(g.weight);
    data[`p${k}_part`] = participation.get(g.index) ?? "";
    data[`crit${k}`] = criteriaFor(g);
    data[`a${k}_n`] = String(annexCriteria[i].count);
    data[`a${k}_xml`] = annexCriteria[i].xml;
  });
  for (let k = 1; k <= MAX_GATE_COLUMNS; k++) data[`n${k}`] = rows[k - 1]?.name ?? "";
  data.projetos_extra = nProjects > MAX_GATE_COLUMNS ? `Projetos não exibidos na tabela: ${rows.slice(MAX_GATE_COLUMNS).map((r) => r.name).join(", ")}.` : "";

  const top3 = rows.slice(0, 3);
  const charts: ReportChartsData = {
    weights: grouped.map((g) => ({ name: g.name, weight: g.weight })),
    radar: {
      axes: grouped.map((g) => g.name),
      series: top3.map((r) => ({ name: r.name, values: r.groupPerformance.map((p) => p * 10) })),
    },
    composition: {
      pillars: grouped.map((g) => g.name),
      rows: rows.map((r) => ({ name: r.name, points: r.groupPoints.map((p) => p / 10) })),
    },
  };

  return { data, charts };
}
