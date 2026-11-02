/**
 * Catálogo de planos — fonte: Tabela_Precificacao.xlsx (aba "Tabela de Preços").
 * Os nomes são provisórios (a própria planilha pede confirmação): ajustar só aqui.
 * Hoje é só vitrine: a contratação é manual (G2A libera os créditos) e os limites abaixo
 * ainda não são aplicados pelo sistema.
 */
export interface Plan {
  code: string;
  name: string;
  /** Faixa de projetos (alternativas) atendida pelo plano, inclusive nas pontas. */
  projectsMin: number;
  projectsMax: number;
  priceBrl: number;
  /** null = simulações ilimitadas. */
  simulationLimit: number | null;
  validityMonths: number;
  maxInstallments: number;
}

export const PLANS: readonly Plan[] = [
  { code: "P1", name: "Entrada", projectsMin: 1, projectsMax: 10, priceBrl: 5000, simulationLimit: 10, validityMonths: 6, maxInstallments: 3 },
  { code: "P2", name: "Intermediário", projectsMin: 11, projectsMax: 18, priceBrl: 10000, simulationLimit: null, validityMonths: 6, maxInstallments: 3 },
  { code: "P3", name: "Avançado", projectsMin: 19, projectsMax: 50, priceBrl: 35000, simulationLimit: null, validityMonths: 6, maxInstallments: 3 },
  { code: "P4", name: "Corporativo", projectsMin: 51, projectsMax: 100, priceBrl: 50000, simulationLimit: null, validityMonths: 6, maxInstallments: 3 },
];

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlWhole = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function formatBrl(value: number): string {
  return Number.isInteger(value) ? brlWhole.format(value) : brl.format(value);
}

/** Valor de cada parcela, arredondado ao centavo (a diferença de centavos fica por conta do gateway). */
export function installmentValue(priceBrl: number, installments: number): number {
  return Math.round((priceBrl / installments) * 100) / 100;
}

export function formatProjectRange(plan: Pick<Plan, "projectsMin" | "projectsMax">): string {
  return `${plan.projectsMin} a ${plan.projectsMax} projetos`;
}

export function formatSimulations(plan: Pick<Plan, "simulationLimit">): string {
  return plan.simulationLimit === null ? "Simulações ilimitadas" : `Até ${plan.simulationLimit} simulações`;
}

export function formatValidity(plan: Pick<Plan, "validityMonths">): string {
  return plan.validityMonths === 1 ? "1 mês" : `${plan.validityMonths} meses`;
}
