export const G2A_CONTACT_EMAIL = "contato@g2aconsultores.com.br";

export function contactMailto(subject: string, userEmail?: string): string {
  const body = userEmail ? `Conta: ${userEmail}` : "";
  const params = new URLSearchParams({ subject, ...(body && { body }) });
  // URLSearchParams usa "+" para espaços; mailto espera %20.
  return `mailto:${G2A_CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}
