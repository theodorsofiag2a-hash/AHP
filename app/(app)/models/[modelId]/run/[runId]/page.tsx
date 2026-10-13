import { notFound } from "next/navigation";
import { canManageModels, requireOrgContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { ModelTabs } from "@/components/ahp/model-tabs";
import { CrMeter } from "@/components/ahp/cr-meter";
import { RankingChart } from "@/components/ahp/ranking-chart";
import { AhpRadarChart } from "@/components/ahp/radar-chart";
import { RankingTable } from "@/components/ahp/ranking-table";
import { ExportCsvButton } from "@/components/ahp/export-csv-button";
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
  const org = await requireOrgContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name")
    .eq("id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!model) notFound();

  const { data: run } = await supabase
    .from("ahp_runs")
    .select("id, consistency_ratio, pillar_weights, created_at")
    .eq("id", runId)
    .eq("model_id", modelId)
    .eq("organization_id", org.organizationId)
    .maybeSingle();
  if (!run) notFound();

  const { data: pillars } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });
  const pillarNameById = new Map((pillars ?? []).map((p) => [p.id, p.name]));

  const { data: results } = await supabase
    .from("ahp_run_results")
    .select("rank, final_score, pillar_scores, pillar_scores_radar, ahp_alternatives(name)")
    .eq("run_id", runId)
    .order("rank", { ascending: true });

  const ranking = (results ?? []).map((r) => {
    const alternative = r.ahp_alternatives as unknown as { name: string } | { name: string }[] | null;
    const altName = Array.isArray(alternative) ? alternative[0]?.name : alternative?.name;
    return {
      rank: r.rank,
      name: altName ?? "—",
      finalScore: Number(r.final_score),
      pillarScores: (r.pillar_scores as PillarScoreEntry[]) ?? [],
      pillarScoresRadar: (r.pillar_scores_radar as PillarScoreEntry[]) ?? [],
    };
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
          <h1 className="text-2xl font-semibold">{model.name}</h1>
          <p className="text-sm text-text-muted">
            Execução em {new Date(run.created_at).toLocaleString("pt-BR")}
          </p>
        </div>
        <ExportCsvButton
          modelName={model.name}
          consistencyRatio={Number(run.consistency_ratio)}
          pillarWeights={pillarWeights}
          ranking={ranking}
        />
      </div>

      <ModelTabs modelId={model.id} canManage={canManageModels(org.role)} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
    </div>
  );
}
