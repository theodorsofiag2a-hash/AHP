# Relatório de priorização (Word)

O botão **Gerar relatório** (fim da página de resultado de uma execução, só em modelos de projeto) baixa o
*Premissário e Relatório de Priorização BESS* em `.docx`, preenchido com o ranking, os pesos, os gráficos e a
análise de sensibilidade da execução.

## Como funciona

1. `POST /models/[modelId]/run/[runId]/report` (`app/(app)/models/[modelId]/run/[runId]/report/route.ts`) lê a
   execução com a sessão do usuário (RLS) e monta um `ReportInput`.
2. `lib/report/build-data.ts` transforma o `ReportInput` nos dados dos marcadores e dos gráficos. Os 5 pilares da AHP
   são agrupados nos 4 do modelo Word (`lib/report/pillars.ts`: Implantação e Sócio Ambiental formam o Pilar 4).
3. `lib/report/charts.ts` desenha 3 gráficos em SVG e converte para PNG (resvg, fontes DejaVu em `lib/report/fonts`).
4. `lib/report/render.ts` preenche o modelo Word (docxtemplater) e troca as 3 imagens do modelo pelos gráficos.

## O modelo Word NÃO está no repositório (que é público)

Fica em um bucket **privado** do Supabase Storage chamado `report-templates` (sem políticas: só a service role lê):

| Arquivo | O que é |
| --- | --- |
| `bess-project.docx` | Modelo com marcadores `{...}` |
| `bess-project.criteria.json` | (opcional) `{ "<nome do critério sem acento, minúsculo>": { "definition", "reading" } }` |

Criar o bucket: Supabase → Storage → New bucket → `report-templates`, **Private**. Depois enviar os dois arquivos.
Sem o arquivo, o botão mostra “O modelo do relatório ainda não foi configurado”.

## Marcadores do modelo

Texto simples: `{cliente} {responsavel} {numero} {data_mes} {data_execucao} {n_criterios} {pesos_inline}
{pesos_texto} {pesos_leitura} {resumo_ranking} {resumo_diferenciais} {conc_a} {conc_b} {conc_c}
{sens_neutro} {sens_conservador} {sens_execucao} {sens_conclusao} {anexo_nota} {a5_titulo} {a5_cr}
{projetos_extra}`, `{p1_nome}`…`{p4_nome}`, `{p1_peso}`…, `{p1_part}`…, `{a1_n}`…`{a4_n}`, `{n1}`…`{n8}`.

Tabelas com linha repetida: `{#ranking}…{/ranking}` (`posicao projeto nota pilar_top diferenciais riscos obs`) e
`{#crit1}…{/crit1}` a `{#crit4}` (`criterio definicao escala peso leitura`).

XML cru (tabelas dos anexos): `{@a1_xml}` … `{@a4_xml}`, `{@a5_xml}` (o marcador deve ficar sozinho no parágrafo).

## Figuras

O tamanho de cada figura no Word precisa bater com `CHART_SIZES` em `lib/report/charts.ts`:
pesos 16×7 cm, radar 12×11 cm, composição 16×9 cm (imagens `word/media/image1.png` a `image3.png`).

## Testar localmente com o modelo real

```bash
REPORT_TEMPLATE_PATH=/caminho/modelo.docx REPORT_OUT_PATH=/tmp/saida.docx \
  npx vitest run lib/report/report.e2e.test.ts
```

Em desenvolvimento, `REPORT_TEMPLATE_PATH` também faz a rota ler o modelo do disco (ignorado em produção).

## Limites desta versão

- Os filtros eliminatórios (seção 11) ficam em branco para o analista marcar no Word.
- Os dados vêm do estado atual das fichas; se uma ficha for editada depois da execução, o relatório de uma
  execução antiga reflete a edição (a execução só guarda os resultados).
- Anexos A.1–A.4 mostram os pesos locais fixos do modelo; só os pilares têm comparação pareada (A.5).
- A tabela da seção 11 comporta até 8 projetos (os demais são listados abaixo dela).
