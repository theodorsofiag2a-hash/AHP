"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, AlertCircle, AlertTriangle, Lock } from "lucide-react";
import { toast } from "sonner";
import { saveEvaluation, saveLicensingOverride } from "@/actions/alternatives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input, Label } from "@/components/ui/input";
import { formatDecimal, parseDecimal } from "@/lib/ahp/relative";
import { ConnectionCard } from "@/components/ahp/connection-card";
import type { AutoSubcriterion } from "@/lib/grid/auto-fill";
import type { GridBus } from "@/lib/grid/types";
import { cn } from "@/lib/utils";

interface ScaleOption {
  id: string;
  description: string;
  fulfillmentPct: number;
  /** Faixa eliminatória: o projeto que a escolher sai do ranking. */
  eliminates: boolean;
}

interface SubcriterionOption {
  id: string;
  name: string;
  /** Subcritério relativo (EUST, ICMS): recebe um valor e a nota sai da comparação com a carteira. */
  relative: boolean;
  unit: string | null;
  scales: ScaleOption[];
  /** Triagem: informa a classificação da UF, mas não recebe nota. */
  screening: boolean;
  /** Versão trial: parâmetro não liberado (aparece borrado). */
  locked: boolean;
  /** Complexidade do rito: preenchida pela UF do município, com ajuste manual justificado. */
  licensing: boolean;
}

/** Rito de licenciamento da UF do município do projeto, com o contexto da base. */
export interface LicensingInfo {
  uf: string | null;
  riteLabel: string | null;
  provisional: boolean;
  agency: string | null;
  legalBasis: string | null;
}

export interface LicensingOverrideInfo {
  reason: string;
  byEmail: string | null;
  at: string;
}

interface PillarOption {
  id: string;
  name: string;
  subcriteria: SubcriterionOption[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Barramentos da NT-ONS e regras de preenchimento; só existe em modelos com subcritérios `auto_field`. */
export interface ConnectionConfig {
  buses: GridBus[];
  /** UF do município do projeto: a lista de barramentos mostra só os dela. Nulo = todos. */
  ufFilter: string | null;
  autoSubcriteria: AutoSubcriterion[];
  initialBusId: string | null;
  initialPowerMw: number | null;
  initialMustMw: number | null;
}

const AUTOSAVE_DELAY_MS = 800;

interface Pending {
  selections: Record<string, string>;
  values: Record<string, number | null>;
}

export function EvaluationForm({
  modelId,
  alternativeId,
  pillars,
  initialSelections,
  initialValues,
  connection,
  licensingInfo,
  licensingOverride,
}: {
  modelId: string;
  alternativeId: string;
  pillars: PillarOption[];
  initialSelections: Record<string, string>;
  initialValues: Record<string, string>;
  connection?: ConnectionConfig;
  licensingInfo?: LicensingInfo;
  licensingOverride?: LicensingOverrideInfo | null;
}) {
  const router = useRouter();
  const [adjusting, setAdjusting] = useState(false);
  const [adjustScale, setAdjustScale] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  // Subcritérios preenchidos pelo barramento nesta sessão (selo "auto"); some ao editar à mão.
  const [autoFilled, setAutoFilled] = useState<Set<string>>(new Set());
  const clearAuto = (id: string) =>
    setAutoFilled((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  const pillarRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idPrefix = useId();
  // Seleções ainda não enviadas ao servidor (null = nada pendente). Usado para não perder a última escolha ao sair.
  const unsavedSelections = useRef<Pending | null>(null);

  const relativeIds = pillars.flatMap((p) => p.subcriteria.filter((s) => s.relative).map((s) => s.id));
  const isAnswered = (sub: SubcriterionOption) =>
    sub.relative ? parseDecimal(values[sub.id] ?? "") !== null : Boolean(selections[sub.id]);
  // Triagem e parâmetros bloqueados no trial não entram na contagem de preenchimento.
  const counts = (sub: SubcriterionOption) => !sub.screening && !sub.locked;
  const totalSubcriteria = pillars.reduce((sum, p) => sum + p.subcriteria.filter(counts).length, 0);
  const answered = pillars.reduce((sum, p) => sum + p.subcriteria.filter((s) => counts(s) && isAnswered(s)).length, 0);

  /** Valores digitados -> número, ou null para apagar (campo vazio ou inválido). */
  function numericValues(): Record<string, number | null> {
    return Object.fromEntries(relativeIds.map((id) => [id, parseDecimal(values[id] ?? "")]));
  }

  useEffect(() => {
    if (selections === initialSelections && values === initialValues) return;
    // Autosave com debounce: o estado "Salvando..." precisa acompanhar a mudança da ficha.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAutosaveStatus("saving");
    const pending: Pending = { selections, values: numericValues() };
    unsavedSelections.current = pending;
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      saveEvaluation(modelId, alternativeId, pending.selections, pending.values)
        .then(() => {
          if (unsavedSelections.current === pending) unsavedSelections.current = null;
          setAutosaveStatus("saved");
        })
        .catch((error) => {
          setAutosaveStatus("error");
          toast.error(error instanceof Error ? error.message : "Falha ao salvar automaticamente.");
        });
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selections, values]);

  // Ao sair da página (ou fechar a aba) dentro da janela do debounce, envia o que ficou pendente.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (unsavedSelections.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      window.removeEventListener("beforeunload", warn);
      const pending = unsavedSelections.current;
      if (pending) {
        unsavedSelections.current = null;
        saveEvaluation(modelId, alternativeId, pending.selections, pending.values).catch(() => {});
      }
    };
  }, [modelId, alternativeId]);

  function handleAutoFill(autoSelections: Record<string, string>, autoValues: Record<string, number>) {
    // O que o barramento escolhe sobrescreve o anterior; o autosave existente grava e valida (saveEvaluation).
    setSelections((prev) => ({ ...prev, ...autoSelections }));
    setValues((prev) => ({
      ...prev,
      ...Object.fromEntries(Object.entries(autoValues).map(([id, v]) => [id, formatDecimal(v)])),
    }));
    setAutoFilled((prev) => new Set([...prev, ...Object.keys(autoSelections), ...Object.keys(autoValues)]));
  }

  function scrollToPillar(pillarId: string) {
    pillarRefs.current[pillarId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSave() {
    setAttemptedSave(true);
    startTransition(async () => {
      try {
        await saveEvaluation(modelId, alternativeId, selections, numericValues());
        unsavedSelections.current = null;
        setAutosaveStatus("saved");
        toast.success("Ficha de avaliação salva.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao salvar avaliação.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 flex flex-col gap-2 bg-bg-base py-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          {pillars.map((pillar) => {
            const pillarAnswered = pillar.subcriteria.filter((s) => counts(s) && isAnswered(s)).length;
            const pillarTotal = pillar.subcriteria.filter(counts).length;
            const complete = pillarAnswered === pillarTotal;
            return (
              <button
                key={pillar.id}
                type="button"
                onClick={() => scrollToPillar(pillar.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  complete
                    ? "border-gold-600/40 bg-gold-soft text-gold-700"
                    : pillarAnswered > 0
                      ? "border-border-strong bg-bg-surface-alt text-text-primary"
                      : "border-border-subtle text-text-muted hover:text-text-primary"
                )}
              >
                {pillar.name}
                <span className="text-[10px] opacity-80">
                  {pillarAnswered}/{pillarTotal}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
          <p className="text-xs text-text-muted">
            {answered} de {totalSubcriteria} subcritérios avaliados
          </p>
          {autosaveStatus === "saving" && (
            <span className="flex items-center gap-1 text-xs text-text-faint">
              <Loader2 className="h-3 w-3 animate-spin" /> Salvando...
            </span>
          )}
          {autosaveStatus === "saved" && (
            <span className="flex items-center gap-1 text-xs text-success">
              <Check className="h-3 w-3" /> Progresso salvo
            </span>
          )}
          {autosaveStatus === "error" && (
            <span className="flex items-center gap-1 text-xs text-danger">
              <AlertCircle className="h-3 w-3" /> Falha ao salvar
            </span>
          )}
        </div>
      </div>

      {connection && (
        <ConnectionCard
          modelId={modelId}
          alternativeId={alternativeId}
          buses={connection.buses}
          ufFilter={connection.ufFilter}
          autoSubcriteria={connection.autoSubcriteria}
          initialBusId={connection.initialBusId}
          initialPowerMw={connection.initialPowerMw}
          initialMustMw={connection.initialMustMw}
          onAutoFill={handleAutoFill}
        />
      )}

      <div className="flex flex-col gap-4">
        {pillars.map((pillar) => {
          const pillarAnswered = pillar.subcriteria.filter((s) => counts(s) && isAnswered(s)).length;
          const pillarTotal = pillar.subcriteria.filter(counts).length;
          return (
            <div
              key={pillar.id}
              ref={(el) => {
                pillarRefs.current[pillar.id] = el;
              }}
              className="scroll-mt-16"
            >
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="font-ui text-sm uppercase tracking-[0.16em] text-gold-700">{pillar.name}</CardTitle>
                  <Badge variant={pillarAnswered === pillarTotal ? "gold" : "neutral"}>
                    {pillarAnswered}/{pillarTotal}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {pillar.subcriteria.map((sub) => {
                    const unanswered = attemptedSave && !isAnswered(sub);
                    if (sub.locked) {
                      return (
                        <div key={sub.id} className="relative overflow-hidden rounded-md">
                          <div aria-hidden="true" className="pointer-events-none flex select-none flex-col gap-1.5 opacity-70 blur-sm">
                            <Label>{sub.name}</Label>
                            <Select disabled value="">
                              <option value="">Selecione uma escala</option>
                            </Select>
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center gap-1.5 text-xs font-medium text-text-muted">
                            <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                            Disponível nos planos pagos
                          </div>
                        </div>
                      );
                    }
                    if (sub.screening) {
                      return (
                        <div key={sub.id} className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-surface-alt p-3">
                          <div className="flex items-center gap-2">
                            <Label>{sub.name}</Label>
                            <Badge variant="neutral">não pontua</Badge>
                          </div>
                          {licensingInfo?.riteLabel ? (
                            <div className="flex flex-col gap-0.5 text-sm text-text-muted">
                              <p>
                                {licensingInfo.uf}: rito <strong className="text-text-primary">{licensingInfo.riteLabel}</strong>
                              </p>
                              {licensingInfo.agency && <p className="text-xs">Órgão ambiental: {licensingInfo.agency}</p>}
                              {licensingInfo.legalBasis && <p className="text-xs">Base legal: {licensingInfo.legalBasis}</p>}
                            </div>
                          ) : (
                            <p className="text-sm text-text-muted">
                              Selecione o município do projeto para ver a regra de licenciamento da UF.
                            </p>
                          )}
                        </div>
                      );
                    }
                    if (sub.licensing) {
                      const currentScale = sub.scales.find((sc) => sc.id === selections[sub.id]);
                      return (
                        <div key={sub.id} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Label>{sub.name}</Label>
                            {licensingInfo?.provisional && !licensingOverride && <Badge variant="gold">provisória</Badge>}
                            {licensingOverride && <Badge variant="neutral">ajustada</Badge>}
                          </div>
                          <p className={cn("text-sm", currentScale ? "text-text-primary" : "text-text-faint")}>
                            {currentScale ? currentScale.description : "Preenchida pelo município do projeto."}
                          </p>
                          {licensingInfo?.provisional && !licensingOverride && (
                            <p className="flex items-start gap-1.5 text-xs text-gold-700">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              Rito ainda indefinido nesta UF: a pontuação é provisória. Se souber o rito correto, ajuste abaixo e
                              registre o motivo.
                            </p>
                          )}
                          {licensingOverride && (
                            <p className="text-xs text-text-muted">
                              Ajustada por {licensingOverride.byEmail ?? "usuário"} em{" "}
                              {new Date(licensingOverride.at).toLocaleString("pt-BR")}: {licensingOverride.reason}
                            </p>
                          )}
                          {!adjusting ? (
                            <div>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={!selections[sub.id]}
                                onClick={() => {
                                  setAdjusting(true);
                                  setAdjustScale(selections[sub.id] ?? "");
                                  setAdjustReason("");
                                  setAdjustError(null);
                                }}
                              >
                                Ajustar manualmente
                              </Button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 rounded-md border border-border-subtle p-3">
                              <Select value={adjustScale} onChange={(e) => setAdjustScale(e.target.value)}>
                                {sub.scales.map((scale) => (
                                  <option key={scale.id} value={scale.id}>
                                    {scale.description}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                value={adjustReason}
                                onChange={(e) => setAdjustReason(e.target.value)}
                                placeholder="Justificativa do ajuste (obrigatória)"
                                maxLength={1000}
                              />
                              {adjustError && <p className="text-xs text-danger">{adjustError}</p>}
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => {
                                    setAdjustError(null);
                                    startTransition(async () => {
                                      try {
                                        await saveLicensingOverride(modelId, alternativeId, {
                                          subcriterionId: sub.id,
                                          scaleId: adjustScale,
                                          reason: adjustReason,
                                        });
                                        setSelections((prev) => ({ ...prev, [sub.id]: adjustScale }));
                                        setAdjusting(false);
                                        toast.success("Ajuste registrado.");
                                        router.refresh();
                                      } catch (error) {
                                        setAdjustError(error instanceof Error ? error.message : "Não foi possível salvar o ajuste.");
                                      }
                                    });
                                  }}
                                >
                                  Salvar ajuste
                                </Button>
                                <Button size="sm" variant="secondary" onClick={() => setAdjusting(false)} disabled={isPending}>
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (sub.relative) {
                      const text = values[sub.id] ?? "";
                      const invalid = text.trim() !== "" && parseDecimal(text) === null;
                      return (
                        <div key={sub.id} className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`${idPrefix}-${sub.id}`}>
                              {sub.name}
                              {sub.unit ? <span className="font-normal text-text-muted"> ({sub.unit})</span> : null}
                            </Label>
                            {autoFilled.has(sub.id) && <Badge variant="success">auto</Badge>}
                          </div>
                          <Input
                            id={`${idPrefix}-${sub.id}`}
                            type="text"
                            inputMode="decimal"
                            placeholder="Informe o valor"
                            value={text}
                            onChange={(e) => {
                              setValues((prev) => ({ ...prev, [sub.id]: e.target.value }));
                              clearAuto(sub.id);
                            }}
                            className={cn((unanswered || invalid) && "border-danger")}
                          />
                          <p className={cn("text-xs", invalid ? "text-danger" : "text-text-muted")}>
                            {invalid
                              ? "Use só números, por exemplo 1234,56."
                              : "Menor é melhor. A nota sai ao rodar a análise, comparando com os outros projetos."}
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div key={sub.id} className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`${idPrefix}-${sub.id}`}>{sub.name}</Label>
                          {autoFilled.has(sub.id) && <Badge variant="success">auto</Badge>}
                        </div>
                        <Select
                          id={`${idPrefix}-${sub.id}`}
                          value={selections[sub.id] ?? ""}
                          onChange={(e) => {
                            setSelections((prev) => ({ ...prev, [sub.id]: e.target.value }));
                            clearAuto(sub.id);
                          }}
                          className={cn(!selections[sub.id] && "text-text-faint", unanswered && "border-danger")}
                        >
                          <option value="" disabled>
                            Selecione uma escala
                          </option>
                          {sub.scales.map((scale) => (
                            <option key={scale.id} value={scale.id} className="text-text-primary">
                              {scale.description}
                            </option>
                          ))}
                        </Select>
                        {sub.scales.find((sc) => sc.id === selections[sub.id])?.eliminates && (
                          <p className="text-xs font-medium text-danger">
                            Critério eliminatório: com esta escolha o projeto fica fora do ranking.
                          </p>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-end border-t border-border-subtle pt-4">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar ficha
        </Button>
      </div>
    </div>
  );
}
