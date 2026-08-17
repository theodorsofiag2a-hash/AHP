"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { executeAhpRun } from "@/actions/ahp-run";
import { pillarPairIndexes } from "@/lib/ahp/matrix";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PillarOption {
  id: string;
  name: string;
}

function sliderLabel(value: number, pillarA: string, pillarB: string) {
  if (value === 0) return { text: "Igual importância (1)", tone: "neutral" as const };
  const factor = Math.abs(value) + 1;
  if (value < 0) return { text: `${pillarA} é ${factor}x mais importante`, tone: "left" as const };
  return { text: `${pillarB} é ${factor}x mais importante`, tone: "right" as const };
}

export function PairwiseSliders({ modelId, pillars }: { modelId: string; pillars: PillarOption[] }) {
  const pairs = useMemo(() => pillarPairIndexes(pillars.length), [pillars.length]);
  const [values, setValues] = useState<number[]>(() => pairs.map(() => 0));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit() {
    startTransition(async () => {
      const result = await executeAhpRun(modelId, values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Execução concluída.");
      router.push(`/models/${modelId}/run/${result.runId}`);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        {pairs.map(([i, j], k) => {
          const label = sliderLabel(values[k], pillars[i].name, pillars[j].name);
          return (
            <Card key={`${i}-${j}`}>
              <CardContent className="flex flex-col gap-3 py-4">
                <div className="flex items-center gap-4">
                  <span className="w-1/3 text-right text-sm font-medium text-text-primary">{pillars[i].name}</span>
                  <input
                    type="range"
                    min={-8}
                    max={8}
                    step={1}
                    value={values[k]}
                    onChange={(e) =>
                      setValues((prev) => prev.map((v, idx) => (idx === k ? Number(e.target.value) : v)))
                    }
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-bg-surface-alt accent-gold-500"
                  />
                  <span className="w-1/3 text-sm font-medium text-text-primary">{pillars[j].name}</span>
                </div>
                <p
                  className={cn(
                    "text-center text-xs font-semibold",
                    label.tone === "neutral" && "text-text-muted",
                    label.tone === "left" && "text-text-primary",
                    label.tone === "right" && "text-gold-400"
                  )}
                >
                  {label.text}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button onClick={handleSubmit} disabled={isPending} size="lg" className="self-end">
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Processar algoritmo e gerar resultados
      </Button>
    </div>
  );
}
