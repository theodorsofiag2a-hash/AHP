/** A renovação (reiniciar o plano) abre nos últimos dias antes do vencimento e segue aberta depois dele. */
export const RENEWAL_WINDOW_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export function isRenewalWindowOpen(validUntil: string | Date, now: Date = new Date()): boolean {
  const end = validUntil instanceof Date ? validUntil.getTime() : new Date(validUntil).getTime();
  if (Number.isNaN(end)) return false;
  return end - now.getTime() <= RENEWAL_WINDOW_DAYS * DAY_MS;
}

/** Dias inteiros até o vencimento (negativo se já venceu). */
export function daysUntil(validUntil: string | Date, now: Date = new Date()): number {
  const end = validUntil instanceof Date ? validUntil.getTime() : new Date(validUntil).getTime();
  return Math.ceil((end - now.getTime()) / DAY_MS);
}
