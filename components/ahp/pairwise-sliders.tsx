"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
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

const SCALE_MARKS = Array.from({ length: 17 }, (_, i) => i - 8);

function sliderLabel(value: number, pillarA: string, pillarB: string) {
  if (value === 0) return { text: "Igual importância (1)", tone: "neutral" as const };
  const factor = Math.abs(value) + 1;
  if (value < 0) return { text: `${pillarA} é ${factor}x mais importante`, tone: "left" as const };
  return { text: `${pillarB} é ${factor}x mais importante`, tone: "right" as const };
}

export function PairwiseSliders({ modelId, pillars }: { modelId: string; pillars: PillarOption[] }) {
  const pairs = useMemo(() => pillarPairIndexes(pillars.length), [pillars.length]);
  const [values, setValues] = useState<number[]>(() => pairs.map(() => 0));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const scaleListId = useId();

  const isLastPair = currentIndex === pairs.length - 1;
  const [i, j] = pairs[currentIndex];
  const label = sliderLabel(values[currentIndex], pillars[i].name, pillars[j].name);

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
      <p className="text-sm text-text-muted">
        Par {currentIndex + 1} de {pairs.length}
      </p>

      <div className="h-1 w-full overflow-hidden rounded-full bg-bg-surface-alt">
        <div
          className="h-full rounded-full bg-gold-500 transition-all"
          style={{ width: `${((currentIndex + 1) / pairs.length) * 100}%` }}
        />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-5 py-6">
          <div className="flex items-center gap-4">
            <span className="w-1/3 text-right text-sm font-medium text-text-primary">{pillars[i].name}</span>
            <input
              type="range"
              min={-8}
              max={8}
              step={1}
              list={scaleListId}
              value={values[currentIndex]}
              onChange={(e) =>
                setValues((prev) => prev.map((v, idx) => (idx === currentIndex ? Number(e.target.value) : v)))
              }
              className="h-11 flex-1 cursor-pointer appearance-none rounded-full bg-bg-surface-alt accent-gold-600"
            />
            <datalist id={scaleListId}>
              {SCALE_MARKS.map((mark) => (
                <option key={mark} value={mark} />
              ))}
            </datalist>
            <span className="w-1/3 text-sm font-medium text-text-primary">{pillars[j].name}</span>
          </div>
          <p
            className={cn(
              "text-center text-xs font-semibold",
              label.tone === "neutral" && "text-text-muted",
              label.tone === "left" && "text-text-primary",
              label.tone === "right" && "text-gold-700"
            )}
          >
            {label.text}
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <Button
          variant="secondary"
          onClick={() => setCurrentIndex((idx) => Math.max(0, idx - 1))}
          disabled={currentIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" />
          Anterior
        </Button>

        {isLastPair ? (
          <Button onClick={handleSubmit} disabled={isPending} size="lg">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Processar algoritmo e gerar resultados
          </Button>
        ) : (
          <Button onClick={() => setCurrentIndex((idx) => Math.min(pairs.length - 1, idx + 1))}>
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
