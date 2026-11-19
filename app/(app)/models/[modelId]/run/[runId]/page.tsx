import { notFound } from "next/navigation";
import { requireUserContext } from "@/lib/user-context";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { CrMeter } from "@/components/ahp/cr-meter";
import { RankingChart } from "@/components/ahp/ranking-chart";
import { AhpRadarChart } from "@/components/ahp/radar-chart";
import { RankingTable } from "@/components/ahp/ranking-table";
import { ExportCsvButton } from "@/components/ahp/export-csv-button";
import { GenerateReportCard } from "@/components/ahp/generate-report-card";
import { reportAppliesToModel } from "@/lib/report/applies";
import { TrialResultNotice } from "@/components/ahp/trial-result-notice";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { isTrialBilling } from "@/lib/billing/trial";
import { SCREENING } from "@/lib/ahp/scoring";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PillarScoreEntry {
  pillarId: string;
  points?: number;
  value?: number;
}

export default async function RunResultsPage({
  params,
}: {
  params: Promise<{ modelId: string; runId: string }>;
}) {
  const { modelId, runId } = await params;
  const user = await requireUserContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name, category")
    .eq("id", modelId)
    .maybeSingle();
  if (!model) notFound();

  const trial = isTrialBilling(await getBillingSummary(user.userId));
  const withReport = reportAppliesToModel(model);

  const { data: run } = await supabase
    .from("ahp_runs")
    .select("id, consistency_ratio, pillar_weights, created_at")
    .eq("id", runId)
    .eq("model_id", modelId)
    .eq("user_id", user.userId)
    .maybeSingle();
  if (!run) notFound();

  const { data: pillars } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });
  const pillarNameById = new Map((pillars ?? []).map((p) => [p.id, p.name]));

  // Quantos parâmetros pontuam no modelo e quantos a versão gratuita usa (para o aviso do trial).
  const { data: subFlags } = (pillars ?? []).length
    ? await supabase
        .from("ahp_subcriteria")
        .select("score_mode, trial")
        .in("pillar_id", (pillars ?? []).map((p) => p.id))
    : { data: [] as { score_mode: string; trial: boolean }[] };
  const scoringFlags = (subFlags ?? []).filter((s) => s.score_mode !== SCREENING);
  const totalParams = scoringFlags.length;
  const trialParams = scoringFlags.filter((s) => s.trial).length;

  const { data: results } = await supabase
    .from("ahp_run_results")
    .select("rank, final_score, eliminated, eliminated_reason, pillar_scores, pillar_scores_radar, ahp_alternatives(name)")
    .eq("run_id", runId)
    .order("rank", { ascending: true, nullsFirst: false });

  const ranking = (results ?? []).filter((r) => !r.eliminated && r.rank !== null).map((r) => {
    const alternative = r.ahp_alternatives as unknown as { name: string } | { name: string }[] | null;
    const altName = Array.isArray(alternative) ? alternative[0]?.name : alternative?.name;
    return {
      rank: r.rank as number,
      name: altName ?? "—",
      finalScore: Number(r.final_score),
      pillarScores: (r.pillar_scores as PillarScoreEntry[]) ?? [],
      pillarScoresRadar: (r.pillar_scores_radar as PillarScoreEntry[]) ?? [],
    };
  });

  const eliminatedList = (results ?? [])
    .filter((r) => r.eliminated)
    .map((r) => {
      const alternative = r.ahp_alternatives as unknown as { name: string } | { name: string }[] | null;
      const altName = Array.isArray(alternative) ? alternative[0]?.name : alternative?.name;
      return { name: altName ?? "—", reason: (r.eliminated_reason as string | null) ?? "Critério eliminatório" };
    });

  const pillarNames = (pillars ?? []).map((p) => p.name);

  const rankingChartData = ranking.map((r) => {
    const row: { name: string; [key: string]: string | number } = { name: r.name };
    r.pillarScores.forEach((entry) => {
      row[pillarNameById.get(entry.pillarId) ?? entry.pillarId] = entry.points ?? 0;
    });
    return row;
  });

  const top3 = ranking.slice(0, 3);
  const radarData = (pillars ?? []).map((pillar) => {
    const row: { pillar: string; [key: string]: string | number } = { pillar: pillar.name };
    top3.forEach((alt) => {
      const entry = alt.pillarScoresRadar.find((e) => e.pillarId === pillar.id);
      row[alt.name] = entry?.value ?? 0;
    });
    return row;
  });

  const pillarWeightsRaw = (run.pillar_weights as { pillarId: string; weight: number }[]) ?? [];
  const pillarWeights = pillarWeightsRaw.map((w) => ({
    name: pillarNameById.get(w.pillarId) ?? w.pillarId,
    weight: w.weight,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-page-title">{model.name}</h1>
          <p className="text-sm text-text-muted">
            Execução em {new Date(run.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <ExportCsvButton
          modelName={model.name}
          consistencyRatio={Number(run.consistency_ratio)}
          pillarWeights={pillarWeights}
          ranking={ranking}
          eliminated={eliminatedList}
        />
      </div>

      <ModelTabs modelId={model.id} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <CrMeter consistencyRatio={Number(run.consistency_ratio)} />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Pesos dos pilares</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {pillarWeights.map((w) => (
              <div key={w.name} className="flex items-center justify-between text-sm">
                <span className="text-text-muted">{w.name}</span>
                <Badge variant="gold">{(w.weight * 100).toFixed(1)}%</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ranking final</CardTitle>
        </CardHeader>
        <CardContent>
          <RankingTable rows={ranking} />
        </CardContent>
      </Card>

      {eliminatedList.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Projetos eliminados</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <p className="text-sm text-text-muted">
              Estes projetos têm um critério eliminatório e ficaram fora do ranking e da comparação entre os demais.
            </p>
            {eliminatedList.map((e) => (
              <div key={e.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-text-primary">{e.name}</span>
                <Badge variant="neutral">{e.reason}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Composição da nota por pilar</CardTitle>
          </CardHeader>
          <CardContent>
            <RankingChart data={rankingChartData} pillarNames={pillarNames} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Impressão digital — Top 3</CardTitle>
          </CardHeader>
          <CardContent>
            <AhpRadarChart data={radarData} seriesNames={top3.map((a) => a.name)} />
          </CardContent>
        </Card>
      </div>

      {trial && (
        <TrialResultNotice
          trialParams={trialParams}
          totalParams={totalParams}
          withReport={withReport}
          userEmail={user.userEmail ?? undefined}
        />
      )}

      {withReport && !trial && (
        <GenerateReportCard
          modelId={model.id}
          runId={run.id}
          defaultClientName={user.userName}
          defaultDocumentNumber={`AHP-${new Date(run.created_at).getFullYear()}-${run.id.slice(0, 6).toUpperCase()}`}
        />
      )}
    </div>
  );
}
