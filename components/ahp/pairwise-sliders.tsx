"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { executeAhpRun } from "@/actions/ahp-run";
import { pillarPairIndexes } from "@/lib/ahp/matrix";
import { RUN_COST_CREDITS } from "@/lib/credit-cost";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
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

export function PairwiseSliders({
  modelId,
  pillars,
  creditBalance,
}: {
  modelId: string;
  pillars: PillarOption[];
  creditBalance: number;
}) {
  const pairs = useMemo(() => pillarPairIndexes(pillars.length), [pillars.length]);
  const [values, setValues] = useState<number[]>(() => pairs.map(() => 0));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const router = useRouter();
  const scaleListId = useId();

  const isLastPair = currentIndex === pairs.length - 1;
  const [i, j] = pairs[currentIndex];
  const label = sliderLabel(values[currentIndex], pillars[i].name, pillars[j].name);

  const hasAnswers = values.some((v) => v !== 0) || currentIndex > 0;

  // Respostas do wizard só existem em memória; avisa antes de recarregar/fechar a aba e perder tudo.
  useEffect(() => {
    if (!hasAnswers || submitted) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasAnswers, submitted]);

  function handleSubmit() {
    startTransition(async () => {
      const result = await executeAhpRun(modelId, values);
      if (!result.ok) {
        setConfirmOpen(false);
        toast.error(result.error);
        return;
      }
      setSubmitted(true);
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
              aria-label={`Importância relativa: ${pillars[i].name} versus ${pillars[j].name}`}
              aria-valuetext={label.text}
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
            aria-live="polite"
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
          <Button onClick={() => setConfirmOpen(true)} disabled={isPending} size="lg">
            Gerar resultado
          </Button>
        ) : (
          <Button onClick={() => setCurrentIndex((idx) => Math.min(pairs.length - 1, idx + 1))}>
            Próximo
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => !isPending && setConfirmOpen(false)}
        title="Gerar resultado?"
        description={`Esta execução usa ${RUN_COST_CREDITS} crédito e não pode ser desfeita.`}
      >
        <p className="text-sm text-text-muted">
          Saldo: {creditBalance} → <strong className="text-text-primary">{creditBalance - RUN_COST_CREDITS}</strong>{" "}
          {creditBalance - RUN_COST_CREDITS === 1 ? "crédito" : "créditos"}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)} disabled={isPending}>
            Voltar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirmar e gerar
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
