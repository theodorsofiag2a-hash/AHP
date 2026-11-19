import { HelpCircle } from "lucide-react";

const SCALE = [
  { factor: "1x", meaning: "mesma importância" },
  { factor: "3x", meaning: "um pouco mais importante" },
  { factor: "5x", meaning: "bem mais importante" },
  { factor: "7x", meaning: "muito mais importante" },
  { factor: "9x", meaning: "absolutamente mais importante" },
];

/** Explica, antes das comparações, o que a pessoa está decidindo e como mover o marcador. */
export function PairwiseGuide({ pairCount, pillarCount }: { pairCount: number; pillarCount: number }) {
  return (
    <details open className="group rounded-lg border border-border-subtle bg-bg-surface p-4 text-sm">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-medium text-text-primary [&::-webkit-details-marker]:hidden">
        <HelpCircle className="h-4 w-4 text-gold-600" aria-hidden="true" />
        Como comparar os pilares
        <span className="ml-auto text-xs font-normal text-text-faint group-open:hidden">mostrar</span>
        <span className="ml-auto hidden text-xs font-normal text-text-faint group-open:inline">ocultar</span>
      </summary>

      <div className="mt-3 flex flex-col gap-3 text-text-muted">
        <p>
          Aqui você define <strong className="text-text-primary">o quanto cada pilar pesa na sua decisão</strong>. Os{" "}
          {pillarCount} pilares aparecem em pares ({pairCount} comparações), e em cada par você responde: qual dos dois é
          mais importante para este projeto, e quanto?
        </p>

        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong className="text-text-primary">Mesma importância:</strong> deixe o marcador no meio.
          </li>
          <li>
            <strong className="text-text-primary">Um pesa mais:</strong> arraste o marcador para o lado dele. Quanto mais
            perto da ponta, maior a diferença.
          </li>
          <li>
            <strong className="text-text-primary">Na dúvida:</strong> deixe no meio. Se todos ficarem no meio, os pilares
            terão o mesmo peso.
          </li>
        </ul>

        <div className="flex flex-wrap gap-2" aria-label="Escala de importância">
          {SCALE.map((s) => (
            <span key={s.factor} className="rounded-full border border-border-subtle bg-bg-surface-alt px-2.5 py-1 text-xs">
              <strong className="text-text-primary">{s.factor}</strong> {s.meaning}
            </span>
          ))}
        </div>

        <p>
          <strong className="text-text-primary">Exemplo:</strong> se o retorno financeiro pesa bem mais do que a engenharia
          na sua decisão, mova o marcador para o lado de Financeiro até cerca de 5x.
        </p>

        <p>
          <strong className="text-text-primary">Seja coerente:</strong> se Financeiro vale mais que Engenharia, e
          Engenharia vale mais que Conexão, então Financeiro deve valer mais que Conexão. O sistema mede essa coerência
          (Razão de Consistência, CR): até 10%, as comparações são consistentes; acima disso, vale revisar as
          respostas.
        </p>

        <p className="text-xs text-text-faint">
          Os pesos dos parâmetros dentro de cada pilar já vêm definidos pela G2A. Aqui você ajusta só o peso entre os
          pilares.
        </p>
      </div>
    </details>
  );
}
