"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveModelStructure, type ModelFormInput } from "@/actions/models";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";

interface ScaleState {
  id: string;
  description: string;
  fulfillmentPct: number;
}

interface SubcriterionState {
  id: string;
  name: string;
  weightPct: number;
  scales: ScaleState[];
}

interface PillarState {
  id: string;
  name: string;
  subcriteria: SubcriterionState[];
}

function uuid() {
  return crypto.randomUUID();
}

function emptyScale(): ScaleState {
  return { id: uuid(), description: "", fulfillmentPct: 100 };
}

function emptySubcriterion(): SubcriterionState {
  return { id: uuid(), name: "", weightPct: 0, scales: [emptyScale()] };
}

function emptyPillar(): PillarState {
  return { id: uuid(), name: "", subcriteria: [emptySubcriterion()] };
}

export function ModelTreeBuilder({
  modelId,
  initialName,
  initialPillars,
}: {
  modelId: string;
  initialName: string;
  initialPillars: PillarState[];
}) {
  const [name, setName] = useState(initialName);
  const [pillars, setPillars] = useState<PillarState[]>(
    initialPillars.length > 0 ? initialPillars : [emptyPillar(), emptyPillar()]
  );
  const [isPending, startTransition] = useTransition();

  function updatePillar(pillarId: string, patch: Partial<PillarState>) {
    setPillars((prev) => prev.map((p) => (p.id === pillarId ? { ...p, ...patch } : p)));
  }

  function updateSubcriterion(pillarId: string, subId: string, patch: Partial<SubcriterionState>) {
    setPillars((prev) =>
      prev.map((p) =>
        p.id !== pillarId
          ? p
          : { ...p, subcriteria: p.subcriteria.map((s) => (s.id === subId ? { ...s, ...patch } : s)) }
      )
    );
  }

  function updateScale(pillarId: string, subId: string, scaleId: string, patch: Partial<ScaleState>) {
    setPillars((prev) =>
      prev.map((p) =>
        p.id !== pillarId
          ? p
          : {
              ...p,
              subcriteria: p.subcriteria.map((s) =>
                s.id !== subId
                  ? s
                  : { ...s, scales: s.scales.map((sc) => (sc.id === scaleId ? { ...sc, ...patch } : sc)) }
              ),
            }
      )
    );
  }

  function addPillar() {
    setPillars((prev) => [...prev, emptyPillar()]);
  }

  function removePillar(pillarId: string) {
    setPillars((prev) => prev.filter((p) => p.id !== pillarId));
  }

  function addSubcriterion(pillarId: string) {
    setPillars((prev) =>
      prev.map((p) => (p.id === pillarId ? { ...p, subcriteria: [...p.subcriteria, emptySubcriterion()] } : p))
    );
  }

  function removeSubcriterion(pillarId: string, subId: string) {
    setPillars((prev) =>
      prev.map((p) =>
        p.id === pillarId ? { ...p, subcriteria: p.subcriteria.filter((s) => s.id !== subId) } : p
      )
    );
  }

  function addScale(pillarId: string, subId: string) {
    setPillars((prev) =>
      prev.map((p) =>
        p.id !== pillarId
          ? p
          : {
              ...p,
              subcriteria: p.subcriteria.map((s) =>
                s.id === subId ? { ...s, scales: [...s.scales, emptyScale()] } : s
              ),
            }
      )
    );
  }

  function removeScale(pillarId: string, subId: string, scaleId: string) {
    setPillars((prev) =>
      prev.map((p) =>
        p.id !== pillarId
          ? p
          : {
              ...p,
              subcriteria: p.subcriteria.map((s) =>
                s.id !== subId ? s : { ...s, scales: s.scales.filter((sc) => sc.id !== scaleId) }
              ),
            }
      )
    );
  }

  function handleSave() {
    const payload: ModelFormInput = { name, pillars };

    startTransition(async () => {
      try {
        await saveModelStructure(modelId, payload);
        toast.success("Modelo salvo com sucesso.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Falha ao salvar o modelo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="model-name">Nome do modelo</Label>
        <Input
          id="model-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ex: Fornecedores BESS LRCAP"
          className="max-w-md text-base font-medium"
        />
      </div>

      <div className="flex flex-col gap-4">
        {pillars.map((pillar, pillarIndex) => (
          <Card key={pillar.id}>
            <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
              <div className="flex flex-1 items-center gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gold-soft text-xs font-semibold text-gold-300">
                  P{pillarIndex + 1}
                </span>
                <Input
                  value={pillar.name}
                  onChange={(e) => updatePillar(pillar.id, { name: e.target.value })}
                  placeholder="Nome do pilar (ex: Custo)"
                  className="font-medium"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removePillar(pillar.id)}
                disabled={pillars.length <= 2}
                title={pillars.length <= 2 ? "O modelo precisa de ao menos 2 pilares" : "Remover pilar"}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="flex flex-col gap-4">
              {pillar.subcriteria.map((sub) => (
                <div key={sub.id} className="rounded-lg border border-border-subtle bg-bg-surface-alt p-4">
                  <div className="flex items-center gap-3">
                    <Input
                      value={sub.name}
                      onChange={(e) => updateSubcriterion(pillar.id, sub.id, { name: e.target.value })}
                      placeholder="Subcritério (ex: Prazo de entrega)"
                      className="flex-1"
                    />
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={sub.weightPct}
                        onChange={(e) =>
                          updateSubcriterion(pillar.id, sub.id, { weightPct: Number(e.target.value) })
                        }
                        className="w-20 text-right"
                      />
                      <span className="text-xs text-text-faint">%</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSubcriterion(pillar.id, sub.id)}
                      disabled={pillar.subcriteria.length <= 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="mt-3 flex flex-col gap-2 border-t border-border-subtle pt-3">
                    <Label>Escalas de desempenho</Label>
                    {sub.scales.map((scale) => (
                      <div key={scale.id} className="flex items-center gap-2">
                        <Textarea
                          value={scale.description}
                          onChange={(e) =>
                            updateScale(pillar.id, sub.id, scale.id, { description: e.target.value })
                          }
                          placeholder="Ex: Excelente"
                          rows={1}
                          className="flex-1 resize-none"
                        />
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={scale.fulfillmentPct}
                            onChange={(e) =>
                              updateScale(pillar.id, sub.id, scale.id, {
                                fulfillmentPct: Number(e.target.value),
                              })
                            }
                            className="w-20 text-right"
                          />
                          <span className="text-xs text-text-faint">%</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeScale(pillar.id, sub.id, scale.id)}
                          disabled={sub.scales.length <= 1}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="ghost" size="sm" className="self-start" onClick={() => addScale(pillar.id, sub.id)}>
                      <Plus className="h-3.5 w-3.5" />
                      Escala
                    </Button>
                  </div>
                </div>
              ))}

              <Button variant="secondary" size="sm" className="self-start" onClick={() => addSubcriterion(pillar.id)}>
                <Plus className="h-4 w-4" />
                Subcritério
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={addPillar}>
          <Layers className="h-4 w-4" />
          Adicionar pilar
        </Button>
        <Button onClick={handleSave} disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar modelo
        </Button>
      </div>
    </div>
  );
}
