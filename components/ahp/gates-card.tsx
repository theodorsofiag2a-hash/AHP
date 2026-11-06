"use client";

import { useState, useTransition } from "react";
import { Ban, CircleHelp, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { saveGates } from "@/actions/alternatives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GATES, assessGates, type GateKey, type GateValues } from "@/lib/gates";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: true, label: "Atende" },
  { value: false, label: "Não atende" },
  { value: null, label: "Pendente" },
] as const;

export function GatesCard({
  modelId,
  alternativeId,
  initialValues,
}: {
  modelId: string;
  alternativeId: string;
  initialValues: GateValues;
}) {
  const [values, setValues] = useState<GateValues>(initialValues);
  const [, startTransition] = useTransition();
  const assessment = assessGates(values);

  function change(key: GateKey, value: boolean | null) {
    const previous = values;
    const next = { ...values, [key]: value };
    setValues(next);
    startTransition(async () => {
      try {
        await saveGates(modelId, alternativeId, next);
      } catch (error) {
        setValues(previous);
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o filtro.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-gold-600" /> Filtros eliminatórios
          </CardTitle>
          <CardDescription>
            Requisitos de passa ou não passa. Quem não atende a algum deles fica fora do ranking, qualquer que seja a nota.
          </CardDescription>
        </div>
        {assessment.status === "eliminated" && (
          <Badge variant="danger">
            <Ban className="h-3 w-3" /> Fora do ranking
          </Badge>
        )}
        {assessment.status === "pending" && (
          <Badge variant="gold">
            <CircleHelp className="h-3 w-3" /> {assessment.pending.length} pendente{assessment.pending.length === 1 ? "" : "s"}
          </Badge>
        )}
        {assessment.status === "passed" && <Badge variant="success">Todos atendidos</Badge>}
      </CardHeader>
      <CardContent className="flex flex-col divide-y divide-border-subtle">
        {GATES.map((gate) => (
          <div key={gate.key} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="sm:max-w-md">
              <p className="text-sm font-medium text-text-primary">{gate.label}</p>
              <p className="text-xs text-text-muted">{gate.requirement}</p>
            </div>
            <div role="radiogroup" aria-label={gate.label} className="flex shrink-0 overflow-hidden rounded border border-border-strong">
              {OPTIONS.map((option) => {
                const selected = values[gate.key] === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => change(gate.key, option.value)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium transition-colors",
                      selected
                        ? option.value === false
                          ? "bg-danger-soft text-danger"
                          : option.value === true
                            ? "bg-success-soft text-success"
                            : "bg-bg-surface-alt text-text-primary"
                        : "bg-bg-surface text-text-muted hover:bg-bg-surface-alt"
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
