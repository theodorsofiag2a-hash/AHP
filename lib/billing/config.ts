import "server-only";

/**
 * Interruptor das telas e ações de compra (integração Asaas). Fica desligado em produção até o go-live,
 * para que o merge na master não publique a compra antes da hora. Só o valor exato "true" liga.
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}
