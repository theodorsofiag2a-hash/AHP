import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { requireUserContext } from "@/lib/user-context";
import { requireModelAccess } from "@/lib/ahp/model-access-server";
import { createClient } from "@/lib/supabase/server";
import {
  EvaluationForm,
  type ConnectionConfig,
  type LicensingInfo,
  type LicensingOverrideInfo,
} from "@/components/ahp/evaluation-form";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { isTrialBilling } from "@/lib/billing/trial";
import { isLocked, SCREENING } from "@/lib/ahp/scoring";
import { RITE_LABEL, isProvisionalRite, isRite } from "@/lib/licensing";
import type { AutoSubcriterion } from "@/lib/grid/auto-fill";
import { GRID_BUS_COLUMNS, parseAutoField, parseAutoMatch, toGridBus, type GridBusRow } from "@/lib/grid/types";
import { MunicipalityCard } from "@/components/ahp/municipality-card";
import { RELATIVE_LOWER, formatDecimal } from "@/lib/ahp/relative";
import { listMunicipalities } from "@/actions/municipalities";

export default async function AlternativeEvaluationPage({
  params,
}: {
  params: Promise<{ modelId: string; alternativeId: string }>;
}) {
  const { modelId, alternativeId } = await params;
  const user = await requireUserContext();
  const supabase = await createClient();

  const { data: model } = await supabase
    .from("ahp_models")
    .select("id, name, trial_available")
    .eq("id", modelId)
    .maybeSingle();
  if (!model) notFound();
  await requireModelAccess(model, user.userId);

  const { data: alternative } = await supabase
    .from("ahp_alternatives")
    .select("id, name, municipality_ibge, bus_id, power_mw, must_mw")
    .eq("id", alternativeId)
    .eq("model_id", modelId)
    .maybeSingle();
  if (!alternative) notFound();

  const { data: pillars } = await supabase
    .from("ahp_pillars")
    .select("id, name, sort_order")
    .eq("model_id", modelId)
    .order("sort_order", { ascending: true });

  const pillarIds = (pillars ?? []).map((p) => p.id);

  const { data: subcriteria } = pillarIds.length
    ? await supabase
        .from("ahp_subcriteria")
        .select("id, pillar_id, name, sort_order, score_mode, value_unit, auto_source, auto_field, trial")
        .in("pillar_id", pillarIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const subcriterionIds = (subcriteria ?? []).map((s) => s.id);

  const { data: scales } = subcriterionIds.length
    ? await supabase
        .from("ahp_scales")
        .select("id, subcriterion_id, description, fulfillment_pct, eliminates, sort_order, auto_match")
        .in("subcriterion_id", subcriterionIds)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const trial = isTrialBilling(await getBillingSummary(user.userId));

  const { data: existingScores } = await supabase
    .from("ahp_alternative_scores")
    .select("subcriterion_id, scale_id, override_reason, overridden_by_email, overridden_at")
    .eq("alternative_id", alternativeId);

  const { data: existingValues } = await supabase
    .from("ahp_alternative_values")
    .select("subcriterion_id, raw_value")
    .eq("alternative_id", alternativeId);

  const assembledPillars = (pillars ?? []).map((pillar) => ({
    id: pillar.id,
    name: pillar.name,
    subcriteria: (subcriteria ?? [])
      .filter((s) => s.pillar_id === pillar.id)
      .map((sub) => ({
        id: sub.id,
        name: sub.name,
        relative: sub.score_mode === RELATIVE_LOWER,
        unit: sub.value_unit,
        screening: sub.score_mode === SCREENING,
        locked: isLocked(sub, trial),
        licensing: sub.auto_source === "licensing" && sub.score_mode !== SCREENING,
        scales: (scales ?? [])
          .filter((sc) => sc.subcriterion_id === sub.id)
          .map((sc) => ({
            id: sc.id,
            description: sc.description,
            fulfillmentPct: Number(sc.fulfillment_pct),
            eliminates: Boolean(sc.eliminates),
          })),
      })),
  }));

  const initialSelections = Object.fromEntries(
    (existingScores ?? []).map((s) => [s.subcriterion_id, s.scale_id])
  );

  // Só modelos com subcritérios ligados ao barramento (auto_field) mostram o cartão de conexão.
  const autoSubcriteria: AutoSubcriterion[] = [];
  for (const sub of subcriteria ?? []) {
    const autoField = parseAutoField(sub.auto_field);
    if (!autoField) continue;
    autoSubcriteria.push({
      id: sub.id,
      name: sub.name,
      autoField,
      relative: sub.score_mode === RELATIVE_LOWER,
      scales: (scales ?? [])
        .filter((sc) => sc.subcriterion_id === sub.id)
        .map((sc) => ({ id: sc.id, autoMatch: parseAutoMatch(sc.auto_match) })),
    });
  }

  // Município só aparece nos modelos que têm algum parâmetro preenchido por ele (Ng e licenciamento).
  let municipalityUf = "";
  const usesMunicipality = (subcriteria ?? []).some((s) => s.auto_source === "ng" || s.auto_source === "licensing");
  let municipalityNg: number | null = null;
  let municipalityOptions: { ibge_code: number; name: string; ng: number | null }[] = [];
  if (usesMunicipality && alternative.municipality_ibge) {
    const { data: current } = await supabase
      .from("municipalities")
      .select("uf, ng")
      .eq("ibge_code", alternative.municipality_ibge)
      .maybeSingle();
    if (current) {
      municipalityUf = current.uf;
      municipalityNg = current.ng === null ? null : Number(current.ng);
      municipalityOptions = await listMunicipalities(current.uf);
    }
  }

  // Regra de licenciamento da UF do município (rito, órgão, base legal) e ajuste manual já feito.
  let licensingInfo: LicensingInfo | undefined;
  if (municipalityUf && (subcriteria ?? []).some((s) => s.auto_source === "licensing")) {
    const { data: rule } = await supabase
      .from("licensing_rules")
      .select("uf, rite, environmental_agency, legal_basis")
      .eq("uf", municipalityUf)
      .maybeSingle();
    const rite = rule && isRite(rule.rite) ? rule.rite : "nao_informado";
    licensingInfo = {
      uf: municipalityUf,
      riteLabel: RITE_LABEL[rite],
      provisional: isProvisionalRite(rite),
      agency: rule?.environmental_agency ?? null,
      legalBasis: rule?.legal_basis ?? null,
    };
  }
  const licensingSubIds = new Set(
    (subcriteria ?? []).filter((s) => s.auto_source === "licensing" && s.score_mode !== SCREENING).map((s) => s.id)
  );
  const overrideRow = (existingScores ?? []).find((s) => licensingSubIds.has(s.subcriterion_id) && s.override_reason);
  const licensingOverride: LicensingOverrideInfo | null = overrideRow
    ? {
        reason: overrideRow.override_reason as string,
        byEmail: overrideRow.overridden_by_email,
        at: overrideRow.overridden_at as string,
      }
    : null;

  let connection: ConnectionConfig | undefined;
  if (autoSubcriteria.length > 0) {
    // Com o município escolhido, só os barramentos da UF dele (mais o já vinculado, se for de outra UF).
    let busQuery = supabase.from("grid_buses").select(GRID_BUS_COLUMNS);
    if (municipalityUf) {
      busQuery = alternative.bus_id
        ? busQuery.or(`uf.eq.${municipalityUf},id.eq.${alternative.bus_id}`)
        : busQuery.eq("uf", municipalityUf);
    }
    const { data: busRows } = await busQuery.order("uf", { ascending: true }).order("name", { ascending: true });
    connection = {
      buses: ((busRows ?? []) as GridBusRow[]).map(toGridBus),
      ufFilter: municipalityUf || null,
      autoSubcriteria,
      initialBusId: alternative.bus_id,
      initialPowerMw: alternative.power_mw != null ? Number(alternative.power_mw) : null,
      initialMustMw: alternative.must_mw != null ? Number(alternative.must_mw) : null,
    };
  }

  const initialValues = Object.fromEntries(
    (existingValues ?? []).map((v) => [v.subcriterion_id, formatDecimal(Number(v.raw_value))])
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/models/${modelId}/alternatives`}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-text-muted transition-colors hover:text-gold-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para as alternativas
        </Link>
        <h1 className="text-page-title">{alternative.name}</h1>
        <p className="text-sm text-text-muted">Ficha de avaliação — {model.name}</p>
      </div>

      {assembledPillars.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-muted">
            Este modelo ainda não tem pilares e subcritérios configurados. A estrutura do modelo é definida pela G2A.
          </p>
          <ContactG2a subject={`Configurar estrutura do modelo ${model.name}`} userEmail={user.userEmail ?? undefined} />
        </div>
      ) : (
        <>
          {trial && (
            <p className="rounded-md border border-gold-500/30 bg-gold-soft px-3 py-2 text-sm text-gold-700">
              Versão gratuita: rodadas ilimitadas, só com os parâmetros liberados. Os demais aparecem borrados e ficam
              disponíveis na versão completa (contratação sob consulta com a G2A).
            </p>
          )}
          {usesMunicipality && (
            <MunicipalityCard
              modelId={modelId}
              alternativeId={alternativeId}
              initialUf={municipalityUf}
              initialIbge={alternative.municipality_ibge ?? null}
              initialOptions={municipalityOptions}
            />
          )}
        <EvaluationForm
          key={`${alternative.municipality_ibge ?? "sem"}-${municipalityNg ?? "sem-ng"}-${licensingOverride?.at ?? "auto"}`}
          modelId={modelId}
          alternativeId={alternativeId}
          pillars={assembledPillars}
          initialSelections={initialSelections}
          initialValues={initialValues}
          connection={connection}
          licensingInfo={licensingInfo}
          licensingOverride={licensingOverride}
        />
        </>
      )}
    </div>
  );
}
