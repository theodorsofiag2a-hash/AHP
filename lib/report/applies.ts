/**
 * O relatório (Premissário e Relatório de Priorização BESS) vale para os modelos de projeto
 * (categoria `projeto`: visões Investidor e Equipamento de BESS).
 */
export function reportAppliesToModel(model: { category: string | null }): boolean {
  return model.category === "projeto";
}
