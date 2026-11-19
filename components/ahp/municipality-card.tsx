"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MapPin } from "lucide-react";
import { toast } from "sonner";
import { listMunicipalities, setAlternativeMunicipality, type MunicipalityOption } from "@/actions/municipalities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";

const UFS = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR",
  "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
];

export function MunicipalityCard({
  modelId,
  alternativeId,
  initialUf,
  initialIbge,
  initialOptions,
}: {
  modelId: string;
  alternativeId: string;
  initialUf: string;
  initialIbge: number | null;
  initialOptions: MunicipalityOption[];
}) {
  const router = useRouter();
  const [uf, setUf] = useState(initialUf);
  const [options, setOptions] = useState<MunicipalityOption[]>(initialOptions);
  const [ibge, setIbge] = useState<number | null>(initialIbge);
  const [isPending, startTransition] = useTransition();

  const selected = options.find((o) => o.ibge_code === ibge) ?? null;

  function changeUf(next: string) {
    setUf(next);
    setIbge(null);
    setOptions([]);
    if (!next) return;
    startTransition(async () => {
      try {
        setOptions(await listMunicipalities(next));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível carregar os municípios.");
      }
    });
  }

  function changeMunicipality(next: number | null) {
    setIbge(next);
    startTransition(async () => {
      try {
        const result = await setAlternativeMunicipality(modelId, alternativeId, next);
        if (result.applied) toast.success("Descargas atmosféricas preenchidas pelo município.");
        if (result.licensingApplied) toast.success("Licenciamento preenchido pela UF do município.");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar o município.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <MapPin className="h-4 w-4 text-gold-700" aria-hidden="true" />
        <CardTitle className="font-ui text-sm uppercase tracking-[0.16em] text-gold-700">Município do projeto</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[110px_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="municipio-uf">UF</Label>
            <Select id="municipio-uf" value={uf} onChange={(e) => changeUf(e.target.value)} disabled={isPending}>
              <option value="">UF</option>
              {UFS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="municipio-nome">Município</Label>
            <Select
              id="municipio-nome"
              value={ibge === null ? "" : String(ibge)}
              onChange={(e) => changeMunicipality(e.target.value ? Number(e.target.value) : null)}
              disabled={isPending || !uf}
            >
              <option value="">Selecione o município</option>
              {options.map((o) => (
                <option key={o.ibge_code} value={o.ibge_code}>
                  {o.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        <p className="text-xs text-text-muted">
          {selected && selected.ng !== null
            ? `Ng deste município: ${selected.ng} raios/km²/ano. O parâmetro de descargas atmosféricas é preenchido por ele.`
            : selected
              ? "O Ng deste município ainda não foi carregado. Escolha a faixa de descargas atmosféricas na ficha."
              : "Preenche o parâmetro de descargas atmosféricas (Ng) e a complexidade do licenciamento (pela UF)."}
        </p>
      </CardContent>
    </Card>
  );
}
