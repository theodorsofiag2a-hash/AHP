import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { calcularAHPGenerico } from "../ahp/calculate";
import { buildReportData, type ReportInput } from "./build-data";
import { renderCharts } from "./charts";
import { renderReport } from "./render";

/**
 * Teste de ponta a ponta do relatório com o modelo Word real. O modelo é proprietário (não está no repositório):
 * rode com REPORT_TEMPLATE_PATH=/caminho/modelo.docx [REPORT_OUT_PATH=/caminho/saida.docx] npx vitest run lib/report/report.e2e.test.ts
 */
const templatePath = process.env.REPORT_TEMPLATE_PATH;

function fixture(): ReportInput {
  const pillars = [
    { id: "p1", name: "Financeiro" },
    { id: "p2", name: "Engenharia" },
    { id: "p3", name: "Conexão" },
    { id: "p4", name: "Implantação / Operação" },
    { id: "p5", name: "Sócio Ambiental" },
  ];
  const subcriteria = pillars.flatMap((p, pi) =>
    [0, 1, 2].map((k) => ({
      id: `${p.id}s${k}`,
      pillarId: p.id,
      name: `${p.name} critério ${k + 1}`,
      weightPct: 10 + k * 5 + pi,
      scales: [{ description: "Favorável" }, { description: "Intermediário" }, { description: "Desfavorável" }],
    }))
  );
  const pct = [100, 60, 10];
  const altNames = ["BESS 001", "BESS 002", "BESS 003", "BESS 004"];
  const picks = [
    [0, 0, 1, 0, 1],
    [1, 0, 0, 1, 0],
    [2, 1, 1, 0, 0],
    [1, 2, 0, 2, 1],
  ];
  const altInputs = altNames.map((name, ai) => ({
    id: `a${ai}`,
    scores: Object.fromEntries(
      subcriteria.map((s, si) => [s.id, pct[(picks[ai][Math.floor(si / 3)] + (si % 3 === 2 ? 1 : 0)) % 3]])
    ),
  }));
  const sliders = [3, -2, 1, 0, 2, -1, 4, 1, 0, -3];
  const calc = calcularAHPGenerico(
    pillars.map((p) => ({ id: p.id, subcriteria: subcriteria.filter((s) => s.pillarId === p.id).map((s) => ({ id: s.id, weightPct: s.weightPct })) })),
    sliders,
    altInputs
  );
  const comparisons: ReportInput["pillarComparisons"] = [];
  let k = 0;
  for (let i = 0; i < 5; i++)
    for (let j = i + 1; j < 5; j++) {
      const v = sliders[k++];
      comparisons.push({ pillarAId: pillars[i].id, pillarBId: pillars[j].id, saatyValue: v >= 0 ? v + 1 : 1 / (1 - v) });
    }
  return {
    orgName: "Cliente Exemplo S.A.",
    modelName: "Critérios de Projeto",
    runDate: new Date("2026-11-06T15:00:00-03:00"),
    consistencyRatio: calc.consistencyRatio,
    pillars,
    pillarWeights: Object.fromEntries(pillars.map((p, i) => [p.id, calc.pillarWeights[i]])),
    pillarComparisons: comparisons,
    subcriteria,
    results: calc.ranking.map((r) => ({
      alternativeId: r.alternativeId,
      name: altNames[Number(r.alternativeId.slice(1))],
      rank: r.rank,
      finalScore: r.finalScore,
      pillarPoints: Object.fromEntries(pillars.map((p, i) => [p.id, r.pillarScores[i]])),
      pillarRadar: Object.fromEntries(pillars.map((p, i) => [p.id, r.pillarScoresRadar[i]])),
    })),
    alternatives: altInputs.map((a, ai) => ({
      id: a.id,
      connection: ai === 0 ? { note: "Barramento de teste (BA, 500 kV); margem efetiva 1.500 MW; conexão sem restrições.", inviable: null } : null,
      selections: Object.fromEntries(
        subcriteria.map((s) => {
          const score = a.scores[s.id];
          return [s.id, { scaleDescription: score === 100 ? "Favorável" : score === 60 ? "Intermediário" : "Desfavorável", score }];
        })
      ),
    })),
    form: { clientName: "Cliente Exemplo S.A.", responsible: "Fulano de Tal", documentNumber: "AHP-2026-0001" },
    criteriaTexts: { "financeiro criterio 1": { definition: "Definição de teste.", reading: "Leitura de teste." } },
  };
}

describe.skipIf(!templatePath)("relatório (modelo Word real)", () => {
  it("preenche todos os marcadores e gera um .docx válido", () => {
    const { data, charts } = buildReportData(fixture());
    const out = renderReport(readFileSync(templatePath!), data, renderCharts(charts));
    if (process.env.REPORT_OUT_PATH) writeFileSync(process.env.REPORT_OUT_PATH, out);

    const xml = new PizZip(out).file("word/document.xml")!.asText();
    const text = xml.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\{[#/@]?[a-z0-9_]+\}/); // nenhum marcador sobrando
    expect(text).not.toContain("INSERIR RESULTADO");
    expect(text).toContain("Cliente Exemplo S.A.");
    expect(text).toContain("BESS 00");
    expect(out.subarray(0, 2).toString()).toBe("PK");
  });
});
