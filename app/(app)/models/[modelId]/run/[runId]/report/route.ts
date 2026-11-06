import { z } from "zod";
import { requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { buildReportData, type ReportInput } from "@/lib/report/build-data";
import { reportAppliesToModel } from "@/lib/report/applies";
import { loadConnections } from "@/lib/report/connections";
import { renderCharts } from "@/lib/report/charts";
import { renderReport } from "@/lib/report/render";
import { loadReportTemplate } from "@/lib/report/template-store";

export const runtime = "nodejs";

const bodySchema = z.object({
  clientName: z.string().trim().min(1, "Informe o cliente.").max(120, "Nome do cliente muito longo."),
  responsible: z.string().trim().min(1, "Informe o responsável técnico.").max(120, "Nome do responsável muito longo."),
  documentNumber: z.string().trim().min(1, "Informe o número do documento.").max(40, "Número do documento muito longo."),
});

function fail(error: string, status: number) {
  return Response.json({ error }, { status });
}

/** Nome de arquivo seguro (ASCII) para o cabeçalho Content-Disposition. */
function safeFileName(...parts: string[]): string {
  const base = parts
    .join("-")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "relatorio"}.docx`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ modelId: string; runId: string }> }
) {
  const { modelId, runId } = await params;
  const org = await requireOrgContext();
  const supabase = await createClient();

  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.", 400);
    body = parsed.data;
  } catch {
    return fail("Dados inválidos.", 400);
  }

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name")
    .eq("id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!model) return fail("Modelo não encontrado.", 404);
  if (!reportAppliesToModel(model.name)) return fail("Este modelo não tem relatório de priorização.", 400);

  const { data: run } = await supabase
    .from("ahp_runs")
    .select("id, consistency_ratio, pillar_weights, pillar_comparisons, created_at")
    .eq("id", runId)
    .eq("model_id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!run) return fail("Execução não encontrada.", 404);

  const { data: pillarsRaw } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });
  const pillars = pillarsRaw ?? [];
  const pillarIds = pillars.map((p) => p.id);

  const { data: subcriteriaRaw } = pillarIds.length
    ? await supabase
        .from("ahp_subcriteria")
        .select("id, pillar_id, name, weight_pct, sort_order")
        .in("pillar_id", pillarIds)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const subcriteria = subcriteriaRaw ?? [];
  const subIds = subcriteria.map((s) => s.id);

  const { data: scalesRaw } = subIds.length
    ? await supabase
        .from("ahp_scales")
        .select("id, subcriterion_id, description, sort_order")
        .in("subcriterion_id", subIds)
        .order("sort_order", { ascending: true })
    : { data: [] };
  const scales = scalesRaw ?? [];

  const { data: resultsRaw } = await supabase
    .from("ahp_run_results")
    .select("alternative_id, rank, final_score, pillar_scores, pillar_scores_radar, ahp_alternatives(name)")
    .eq("run_id", runId)
    .order("rank", { ascending: true });
  const results = resultsRaw ?? [];
  if (results.length === 0) return fail("Esta execução não tem resultados.", 400);
  const altIds = results.map((r) => r.alternative_id);

  const connections = await loadConnections(supabase, altIds);

  const { data: scoresRaw } = await supabase
    .from("ahp_alternative_scores")
    .select("alternative_id, subcriterion_id, scale_id, score_value")
    .in("alternative_id", altIds);
  const scores = scoresRaw ?? [];
  const scaleDescription = new Map(scales.map((s) => [s.id, s.description]));

  const template = await loadReportTemplate();
  if (!template) {
    return fail("O modelo do relatório ainda não foi configurado. Fale com a G2A.", 503);
  }

  type PillarEntry = { pillarId: string; points?: number; value?: number };
  const input: ReportInput = {
    orgName: org.organizationName,
    modelName: model.name,
    runDate: new Date(run.created_at),
    consistencyRatio: Number(run.consistency_ratio),
    pillars: pillars.map((p) => ({ id: p.id, name: p.name })),
    pillarWeights: Object.fromEntries(
      ((run.pillar_weights as { pillarId: string; weight: number }[]) ?? []).map((w) => [w.pillarId, Number(w.weight)])
    ),
    pillarComparisons: ((run.pillar_comparisons as { pillarAId: string; pillarBId: string; saatyValue: number }[]) ?? []).map(
      (c) => ({ pillarAId: c.pillarAId, pillarBId: c.pillarBId, saatyValue: Number(c.saatyValue) })
    ),
    subcriteria: subcriteria.map((s) => ({
      id: s.id,
      pillarId: s.pillar_id,
      name: s.name,
      weightPct: Number(s.weight_pct),
      scales: scales.filter((sc) => sc.subcriterion_id === s.id).map((sc) => ({ description: sc.description })),
    })),
    results: results.map((r) => {
      const alt = r.ahp_alternatives as unknown as { name: string } | { name: string }[] | null;
      const name = Array.isArray(alt) ? alt[0]?.name : alt?.name;
      return {
        alternativeId: r.alternative_id,
        name: name ?? "—",
        rank: r.rank,
        finalScore: Number(r.final_score),
        pillarPoints: Object.fromEntries(((r.pillar_scores as PillarEntry[]) ?? []).map((e) => [e.pillarId, Number(e.points ?? 0)])),
        pillarRadar: Object.fromEntries(((r.pillar_scores_radar as PillarEntry[]) ?? []).map((e) => [e.pillarId, Number(e.value ?? 0)])),
      };
    }),
    alternatives: altIds.map((id) => ({
      id,
      connection: connections.get(id) ?? null,
      selections: Object.fromEntries(
        scores
          .filter((sc) => sc.alternative_id === id)
          .map((sc) => [
            sc.subcriterion_id,
            { scaleDescription: scaleDescription.get(sc.scale_id) ?? "", score: Number(sc.score_value) },
          ])
      ),
    })),
    form: { clientName: body.clientName, responsible: body.responsible, documentNumber: body.documentNumber },
    criteriaTexts: template.criteriaTexts,
  };

  try {
    const { data, charts } = buildReportData(input);
    const docx = renderReport(template.docx, data, renderCharts(charts));
    return new Response(new Uint8Array(docx), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeFileName("Relatorio-Priorizacao", model.name, body.documentNumber)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Falha ao gerar o relatório", error);
    return fail("Não foi possível gerar o relatório. Tente novamente.", 500);
  }
}
