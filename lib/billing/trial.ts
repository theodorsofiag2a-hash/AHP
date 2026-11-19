import type { BillingSummary } from "./plan-summary";

/**
 * Versão trial (gratuita): conta sem plano vigente e sem créditos. Rodadas ilimitadas, mas só com
 * os parâmetros marcados como trial. Espelha a regra de create_ahp_run() no banco.
 */
export function isTrialBilling(summary: BillingSummary): boolean {
  return summary.mode === "legacy" && summary.creditBalance <= 0;
}
