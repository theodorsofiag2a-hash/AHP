"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, Check, Info, Loader2, Search, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { saveConnection } from "@/actions/alternatives";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { computeAutoFill, type AutoFillMiss, type AutoSubcriterion } from "@/lib/grid/auto-fill";
import type { GridBus } from "@/lib/grid/types";
import { assessViability, type ViabilityStatus } from "@/lib/grid/viability";
import { cn } from "@/lib/utils";

const MAX_RESULTS = 40;

const MISS_REASON: Record<AutoFillMiss, string> = {
  no_data: "sem dado para este barramento",
  no_scale: "nenhuma escala corresponde ao valor",
  ambiguous: "mais de uma escala corresponde ao valor",
};

const STATUS_BADGE: Record<ViabilityStatus, { label: string; variant: "success" | "gold" | "danger" }> = {
  ok: { label: "Conexão viável", variant: "success" },
  attention: { label: "Atenção", variant: "gold" },
  inviable: { label: "Inviável", variant: "danger" },
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

const mw = (value: number) => `${value.toLocaleString("pt-BR")} MW`;
const brl = (value: number) => value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function parsePower(text: string): number | null {
  const value = Number(text.replace(",", ".").trim());
  return text.trim() !== "" && Number.isFinite(value) && value > 0 && value <= 5000 ? value : null;
}

export function ConnectionCard({
  modelId,
  alternativeId,
  buses,
  autoSubcriteria,
  initialBusId,
  initialPowerMw,
  onAutoFill,
}: {
  modelId: string;
  alternativeId: string;
  buses: GridBus[];
  autoSubcriteria: AutoSubcriterion[];
  initialBusId: string | null;
  initialPowerMw: number | null;
  onAutoFill: (selections: Record<string, string>) => void;
}) {
  const idPrefix = useId();
  const [busId, setBusId] = useState<string | null>(initialBusId);
  const [powerText, setPowerText] = useState(initialPowerMw != null ? String(initialPowerMw).replace(".", ",") : "");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [misses, setMisses] = useState<{ name: string; reason: AutoFillMiss }[]>([]);
  const [filledCount, setFilledCount] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const lastSavedPower = useRef<number | null>(initialPowerMw);

  const bus = useMemo(() => buses.find((b) => b.id === busId) ?? null, [buses, busId]);
  const power = parsePower(powerText);
  const powerInvalid = powerText.trim() !== "" && power === null;
  const viability = bus ? assessViability(bus, power) : null;

  const results = useMemo(() => {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    const filtered = terms.length
      ? buses.filter((b) => {
          const haystack = normalize(`${b.name} ${b.uf} ${b.kv} ${b.transmissora ?? ""}`);
          return terms.every((t) => haystack.includes(t));
        })
      : buses;
    return { total: filtered.length, shown: filtered.slice(0, MAX_RESULTS) };
  }, [buses, query]);

  function persist(nextBusId: string | null, nextPower: number | null, onDone?: () => void) {
    startTransition(async () => {
      try {
        await saveConnection(modelId, alternativeId, { busId: nextBusId, powerMw: nextPower });
        lastSavedPower.current = nextPower;
        onDone?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao salvar a conexão.");
      }
    });
  }

  function selectBus(next: GridBus) {
    setBusId(next.id);
    setOpen(false);
    setQuery("");

    const result = computeAutoFill(next, autoSubcriteria);
    setMisses(result.misses.map((m) => ({ name: m.name, reason: m.reason })));
    const filled = Object.keys(result.selections).length;
    setFilledCount(filled);
    onAutoFill(result.selections);
    persist(next.id, power, () => {
      if (filled > 0) toast.success(`${filled} ${filled === 1 ? "campo preenchido" : "campos preenchidos"} pelo barramento.`);
    });
  }

  function handlePowerBlur() {
    if (!bus || powerInvalid || power === lastSavedPower.current) return;
    persist(bus.id, power);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="flex items-center gap-2 font-ui text-sm uppercase tracking-[0.16em] text-gold-700">
            <Zap className="h-4 w-4" /> Barramento de conexão
          </CardTitle>
          <CardDescription>
            Escolha a subestação: margem, viabilidade, bonificação e tarifa vêm da Tabela 4-1 da NT-ONS e preenchem a ficha.
          </CardDescription>
        </div>
        {viability && <Badge variant={STATUS_BADGE[viability.status].variant}>{STATUS_BADGE[viability.status].label}</Badge>}
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px]">
          <div className="relative flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-bus`}>Subestação</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-faint" />
              <Input
                id={`${idPrefix}-bus`}
                type="search"
                role="combobox"
                aria-expanded={open}
                aria-controls={`${idPrefix}-list`}
                autoComplete="off"
                placeholder={bus ? `${bus.name} · ${bus.uf} · ${bus.kv} kV` : "Buscar por nome, UF, tensão ou transmissora"}
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setOpen(false);
                }}
                onBlur={() => setTimeout(() => setOpen(false), 120)}
                className={cn("pl-9", bus && !query && "placeholder:text-text-primary")}
              />
            </div>
            {open && (
              <ul
                id={`${idPrefix}-list`}
                role="listbox"
                aria-label="Barramentos"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-border-subtle bg-bg-surface p-1 shadow-card"
              >
                {results.shown.length === 0 && <li className="px-3 py-2 text-sm text-text-muted">Nenhum barramento encontrado.</li>}
                {results.shown.map((option) => {
                  const optionViability = assessViability(option);
                  return (
                    <li key={option.id} role="option" aria-selected={option.id === busId}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectBus(option)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-bg-surface-alt"
                      >
                        <span className="flex flex-col">
                          <span className="font-medium text-text-primary">{option.name}</span>
                          <span className="text-xs text-text-muted">
                            {option.uf} · {option.kv} kV · margem {mw(option.busMarginMw)}
                          </span>
                        </span>
                        <span
                          aria-label={STATUS_BADGE[optionViability.status].label}
                          className={cn(
                            "h-2.5 w-2.5 shrink-0 rounded-full",
                            optionViability.status === "inviable" && "bg-danger",
                            optionViability.status === "attention" && "bg-gold-600",
                            optionViability.status === "ok" && "bg-success"
                          )}
                        />
                      </button>
                    </li>
                  );
                })}
                {results.total > MAX_RESULTS && (
                  <li className="px-3 py-2 text-xs text-text-faint">
                    Mostrando {MAX_RESULTS} de {results.total}. Refine a busca.
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${idPrefix}-power`}>Potência (MW)</Label>
            <Input
              id={`${idPrefix}-power`}
              inputMode="decimal"
              placeholder="Ex.: 30"
              value={powerText}
              onChange={(e) => setPowerText(e.target.value)}
              onBlur={handlePowerBlur}
              aria-invalid={powerInvalid}
              className={cn(powerInvalid && "border-danger")}
            />
            {powerInvalid && <span className="text-xs text-danger">Use um valor entre 0 e 5.000.</span>}
          </div>
        </div>

        {isPending && (
          <span className="flex items-center gap-1 text-xs text-text-faint">
            <Loader2 className="h-3 w-3 animate-spin" /> Salvando conexão...
          </span>
        )}

        {bus && viability && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-text-primary">{bus.name}</span>
              <Badge variant="neutral">{bus.uf}</Badge>
              <Badge variant="neutral">{bus.kv} kV</Badge>
              {bus.bonified && <Badge variant="success">Bonificado (β = 0,9)</Badge>}
              {bus.physicalClass && <Badge variant="neutral">Classe {bus.physicalClass}</Badge>}
              {bus.transmissora && <Badge variant="neutral">{bus.transmissora}</Badge>}
            </div>

            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label="Margem do barramento" value={mw(bus.busMarginMw)} />
              <Metric label="Limite da sub-área" value={mw(bus.subareaMarginMw)} />
              <Metric label="Limite da área" value={mw(bus.areaMarginMw)} />
              <Metric label="Margem efetiva" value={mw(viability.effectiveMarginMw)} strong />
              <Metric
                label={bus.tustG != null ? "TUST geração" : "TUSDg"}
                value={bus.tustG != null ? `R$ ${brl(bus.tustG)}/kW` : bus.tusdG != null ? `R$ ${brl(bus.tusdG)}/kW` : "Não disponível"}
              />
            </dl>

            {viability.issues.length > 0 && (
              <ul className="flex flex-col gap-1.5">
                {viability.issues.map((issue, index) => (
                  <li
                    key={index}
                    className={cn(
                      "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                      issue.severity === "inviable"
                        ? "border-danger/30 bg-danger-soft text-danger"
                        : "border-gold-600/35 bg-gold-soft text-gold-700"
                    )}
                  >
                    {issue.severity === "inviable" ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{issue.text}</span>
                  </li>
                ))}
              </ul>
            )}

            {filledCount !== null && (
              <div className="flex flex-col gap-1.5 text-sm">
                <p className="flex items-center gap-1.5 text-text-muted">
                  <Check className="h-4 w-4 text-success" />
                  {filledCount} {filledCount === 1 ? "campo preenchido" : "campos preenchidos"} automaticamente (marcados com “auto” na ficha).
                </p>
                {misses.length > 0 && (
                  <div className="flex items-start gap-1.5 text-text-muted">
                    <Info className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      Selecione manualmente:{" "}
                      {misses.map((m, i) => (
                        <span key={m.name}>
                          {i > 0 && "; "}
                          <strong className="font-medium text-text-primary">{m.name}</strong> ({MISS_REASON[m.reason]})
                        </span>
                      ))}
                      .
                    </span>
                  </div>
                )}
              </div>
            )}

            <p className="text-xs text-text-faint">
              Fonte: NT-ONS DPL 0095/2026 (Rev 0), Tabelas 4-1 e 5-1, via Carpe Vie. Valores podem conter erros de transcrição; o documento do ONS prevalece.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border-subtle bg-bg-surface-alt px-3 py-2">
      <dt className="font-ui text-[10px] font-semibold uppercase tracking-[0.16em] text-text-faint">{label}</dt>
      <dd className={cn("text-sm", strong ? "font-semibold text-text-primary" : "text-text-muted")}>{value}</dd>
    </div>
  );
}
