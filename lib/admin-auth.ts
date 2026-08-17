/**
 * Lista de e-mails da equipe interna da G2A com permissão para conceder créditos
 * manualmente (fluxo provisório enquanto não há gateway de pagamento integrado).
 * Configurar via variável de ambiente PLATFORM_ADMIN_EMAILS (separados por vírgula).
 */
export function isPlatformAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowList = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowList.includes(email.toLowerCase());
}
