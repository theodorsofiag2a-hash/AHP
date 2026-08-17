import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface-alt px-4 py-3 font-mono text-sm text-gold-300">
      {children}
    </pre>
  );
}

export default function MethodologyPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Metodologia AHP</h1>
        <p className="text-sm text-text-muted">
          Como a plataforma calcula pesos, consistência e o ranking final.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Comparação pareada</CardTitle>
          <CardDescription>
            Para cada par de pilares, você indica qual é mais importante e o quanto, numa escala de -8 a 8.
            Esse valor é convertido para a escala de Saaty (1 a 9):
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Formula>{`v = 0  →  1 (igual importância)
v < 0  →  |v| + 1  (pilar da esquerda é mais importante)
v > 0  →  1 / (v + 1)  (pilar da direita é mais importante)`}</Formula>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Pesos dos pilares</CardTitle>
          <CardDescription>
            A matriz recíproca resultante é normalizada por coluna e depois cada linha é
            promediada — o método clássico de aproximação de Saaty para o autovetor principal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Formula>{`peso[i] = média_j( matriz[i][j] / soma_coluna[j] )`}</Formula>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Razão de consistência (CR)</CardTitle>
          <CardDescription>
            Mede o quão coerentes foram suas comparações. CR ≤ 10% é considerado aceitável.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Formula>{`λmax = Σ peso[i] × soma_coluna[i]
CR = ((λmax - n) / (n - 1)) / RI`}</Formula>
          <p className="mt-3 text-xs text-text-faint">
            RI é o Índice Randômico de Saaty, tabelado por número de pilares (n).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Nota final por alternativa</CardTitle>
          <CardDescription>
            Para cada pilar, o desempenho da alternativa é a média ponderada dos subcritérios
            (pelos pesos percentuais atribuídos), multiplicada pelo peso do pilar (AHP).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Formula>{`desempenho_pilar = Σ (nota_escala / 100) × (peso_subcritério / soma_pesos_subcritérios)
nota_final = Σ desempenho_pilar[i] × peso_pilar[i] × 1000`}</Formula>
        </CardContent>
      </Card>
    </div>
  );
}
