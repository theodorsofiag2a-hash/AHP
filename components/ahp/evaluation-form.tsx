"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveEvaluation } from "@/actions/alternatives";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [isPending, startTransition] = useTransition();

  const totalSubcriteria = pillars.reduce((sum, p) => sum + p.subcriteria.length, 0);
  const answered = Object.keys(selections).length;

  function handleSave() {
    startTransition(async () => {
      try {
        await saveEvaluation(modelId, alternativeId, selections);
        toast.success("Ficha de avaliação salva.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao salvar avaliação.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        {pillars.map((pillar) => (
          <Card key={pillar.id}>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wide text-gold-300">{pillar.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {pillar.subcriteria.map((sub) => (
                <div key={sub.id} className="flex flex-col gap-1.5">
                  <Label>{sub.name}</Label>
                  <select
                    value={selections[sub.id] ?? ""}
                    onChange={(e) => setSelections((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                    className={cn(
                      "h-10 w-full rounded-lg border border-border-subtle bg-bg-surface-alt px-3 text-sm text-text-primary outline-none transition-colors focus:border-gold-500",
                      !selections[sub.id] && "text-text-faint"
                    )}
                  >
                    <option value="" disabled>
                      Selecione uma escala
                    </option>
                    {sub.scales.map((scale) => (
                      <option key={scale.id} value={scale.id} className="text-text-primary">
                        {scale.description} ({scale.fulfillmentPct}%)
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-text-muted">
          {answered} de {totalSubcriteria} subcritérios avaliados
        </p>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar ficha
        </Button>
      </div>
    </div>
  );
}
