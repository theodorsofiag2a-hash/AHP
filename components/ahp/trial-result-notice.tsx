import { FileText, Lock } from "lucide-react";
import { ContactG2a } from "@/components/layout/contact-g2a";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const REPORT_CONTENTS = [
  "Ranking comentado: nota de cada projeto, pilar de destaque, diferenciais e riscos",
  "Premissas e pesos de cada pilar, com a leitura do que eles significam",
  "Gráficos de pesos, radar por projeto e composição da nota",
  "Análise de sensibilidade em três cenários (neutro, conservador e de execução)",
  "Anexos com critérios, escalas e a matriz de comparação, com a consistência (CR)",
];

/** Aviso no fim do resultado da versão gratuita: o que a versão paga acrescenta. */
export function TrialResultNotice({
  trialParams,
  totalParams,
  withReport,
  userEmail,
}: {
  trialParams: number;
  totalParams: number;
  /** Modelo de projeto: a versão paga inclui o relatório em Word. */
  withReport: boolean;
  userEmail?: string;
}) {
  return (
    <Card className="border-gold-500/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-gold-600" aria-hidden="true" />
          Resultado da versão gratuita
        </CardTitle>
        <CardDescription>
          Este ranking considera só {trialParams} de {totalParams} parâmetros do modelo. Use-o como uma primeira leitura:
          na versão paga, a análise usa todos os parâmetros e o resultado pode mudar.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {withReport && (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <FileText className="h-4 w-4 text-gold-600" aria-hidden="true" />
              Na versão paga, você também recebe o Relatório de Priorização BESS (Word), pronto para levar ao comitê ou
              ao cliente:
            </p>
            <ul className="ml-6 list-disc text-sm text-text-muted">
              {REPORT_CONTENTS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ContactG2a size="sm" label="Falar com a G2A" subject="Versão paga do AHP (relatório e análise completa)" userEmail={userEmail} />
          <span className="text-xs text-text-faint">Contratação sob consulta.</span>
        </div>
      </CardContent>
    </Card>
  );
}
