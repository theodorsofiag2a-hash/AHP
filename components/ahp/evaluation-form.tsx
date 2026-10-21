"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { saveEvaluation } from "@/actions/alternatives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ScaleOption {
  id: string;
  description: string;
  fulfillmentPct: number;
}

interface SubcriterionOption {
  id: string;
  name: string;
  scales: ScaleOption[];
}

interface PillarOption {
  id: string;
  name: string;
  subcriteria: SubcriterionOption[];
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

const AUTOSAVE_DELAY_MS = 800;

export function EvaluationForm({
  modelId,
  alternativeId,
  pillars,
  initialSelections,
}: {
  modelId: string;
  alternativeId: string;
  pillars: PillarOption[];
  initialSelections: Record<string, string>;
}) {
  const [selections, setSelections] = useState<Record<string, string>>(initialSelections);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<SaveStatus>("idle");
  const [isPending, startTransition] = useTransition();

  const pillarRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const autosaveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idPrefix = useId();
  // Seleções ainda não enviadas ao servidor (null = nada pendente). Usado para não perder a última escolha ao sair.
  const unsavedSelections = useRef<Record<string, string> | null>(null);

  const totalSubcriteria = pillars.reduce((sum, p) => sum + p.subcriteria.length, 0);
  const answered = Object.keys(selections).length;

  useEffect(() => {
    if (selections === initialSelections) return;
    setAutosaveStatus("saving");
    unsavedSelections.current = selections;
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
    autosaveTimeout.current = setTimeout(() => {
      saveEvaluation(modelId, alternativeId, selections)
        .then(() => {
          if (unsavedSelections.current === selections) unsavedSelections.current = null;
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
  }, [selections]);

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
        saveEvaluation(modelId, alternativeId, pending).catch(() => {});
      }
    };
  }, [modelId, alternativeId]);

  function scrollToPillar(pillarId: string) {
    pillarRefs.current[pillarId]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleSave() {
    setAttemptedSave(true);
    startTransition(async () => {
      try {
        await saveEvaluation(modelId, alternativeId, selections);
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
            const pillarAnswered = pillar.subcriteria.filter((s) => selections[s.id]).length;
            const pillarTotal = pillar.subcriteria.length;
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

      <div className="flex flex-col gap-4">
        {pillars.map((pillar) => {
          const pillarAnswered = pillar.subcriteria.filter((s) => selections[s.id]).length;
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
                  <Badge variant={pillarAnswered === pillar.subcriteria.length ? "gold" : "neutral"}>
                    {pillarAnswered}/{pillar.subcriteria.length}
                  </Badge>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  {pillar.subcriteria.map((sub) => {
                    const unanswered = attemptedSave && !selections[sub.id];
                    return (
                      <div key={sub.id} className="flex flex-col gap-1.5">
                        <Label htmlFor={`${idPrefix}-${sub.id}`}>{sub.name}</Label>
                        <Select
                          id={`${idPrefix}-${sub.id}`}
                          value={selections[sub.id] ?? ""}
                          onChange={(e) => setSelections((prev) => ({ ...prev, [sub.id]: e.target.value }))}
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
