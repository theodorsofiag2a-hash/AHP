export const G2A_CONTACT_EMAIL = "contato@g2aconsultores.com.br";

export function contactMailto(subject: string, organizationSlug?: string): string {
  const body = organizationSlug ? `Organização (identificador): ${organizationSlug}` : "";
  const params = new URLSearchParams({ subject, ...(body && { body }) });
  // URLSearchParams usa "+" para espaços; mailto espera %20.
  return `mailto:${G2A_CONTACT_EMAIL}?${params.toString().replace(/\+/g, "%20")}`;
}
