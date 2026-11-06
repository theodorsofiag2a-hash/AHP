/**
 * O relatório (Premissário e Relatório de Priorização BESS) vale para os modelos de projeto.
 * Provisório: reconhece pelo nome do modelo ("Critérios de Projeto"); trocar por uma marca no modelo quando existir.
 */
export function reportAppliesToModel(modelName: string): boolean {
  return /projeto/i.test(modelName);
}
