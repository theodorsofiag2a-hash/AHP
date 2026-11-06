import "server-only";

/**
 * Interruptor geral das telas e ações de compra (integração Asaas). Fica desligado em produção até o
 * go-live, para que o merge na master não publique a compra antes da hora. Só o valor exato "true" liga.
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

/** Slugs das organizações-piloto (BILLING_PILOT_ORGS, separados por vírgula). Vazio = sem restrição. */
export function getPilotOrgSlugs(): string[] {
  return (process.env.BILLING_PILOT_ORGS ?? "")
    .split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
}

/**
 * Cobrança ligada para esta organização? Com BILLING_ENABLED=true e BILLING_PILOT_ORGS preenchida, só as
 * organizações listadas enxergam e usam a compra (teste em produção sem expor aos demais clientes).
 */
export function isBillingEnabledFor(organizationSlug: string): boolean {
  if (!isBillingEnabled()) return false;
  const pilots = getPilotOrgSlugs();
  return pilots.length === 0 || pilots.includes(organizationSlug);
}
