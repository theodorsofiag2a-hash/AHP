import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";

/** O Asaas exige token de 32 a 255 caracteres. Fora disso a configuração está errada: nega tudo. */
const MIN_TOKEN_LENGTH = 32;

/**
 * Confere o header `asaas-access-token` em tempo constante. Falha fechada: sem token configurado (ou
 * configurado curto demais), nenhuma requisição passa. Compara os hashes para não vazar o tamanho.
 */
export function isValidWebhookToken(received: string | null | undefined, expected: string | undefined): boolean {
  if (!expected || expected.length < MIN_TOKEN_LENGTH) return false;
  if (!received) return false;
  const a = createHash("sha256").update(received).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
