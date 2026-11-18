import "server-only";

/**
 * Interruptor geral das telas e ações de compra (integração Asaas). Fica desligado em produção até o
 * go-live, para que o merge na master não publique a compra antes da hora. Só o valor exato "true" liga.
 */
export function isBillingEnabled(): boolean {
  return process.env.BILLING_ENABLED === "true";
}

/** E-mails das contas-piloto (BILLING_PILOT_EMAILS, separados por vírgula). Vazio = sem restrição. */
export function getPilotEmails(): string[] {
  return (process.env.BILLING_PILOT_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Cobrança ligada para esta conta? Com BILLING_ENABLED=true e BILLING_PILOT_EMAILS preenchida, só as
 * contas listadas enxergam e usam a compra (teste em produção sem expor aos demais clientes).
 */
export function isBillingEnabledFor(email: string | null | undefined): boolean {
  if (!isBillingEnabled()) return false;
  const pilots = getPilotEmails();
  return pilots.length === 0 || (!!email && pilots.includes(email.toLowerCase()));
}
