import { z } from "zod";
import { isValidCpfCnpj, onlyDigits } from "./document";

/**
 * Dados de cobrança da organização (alimentam o customerData do Checkout). O Asaas exige todos os campos
 * de contato e endereço quando customerData é enviado; só o complemento é opcional. A cidade o Asaas
 * descobre pelo CEP.
 */
export const billingProfileSchema = z.object({
  // O Asaas recusa nome com uma palavra só ("O campo name é inválido"): exige nome e sobrenome ou razão social.
  legalName: z
    .string()
    .trim()
    .max(120, "Nome muito longo (máx. 120).")
    .refine((v) => v.split(/\s+/).filter(Boolean).length >= 2, "Informe o nome completo ou a razão social (ao menos duas palavras)."),
  cpfCnpj: z
    .string()
    .trim()
    .refine((v) => isValidCpfCnpj(v), "CPF ou CNPJ inválido.")
    .transform(onlyDigits),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(160),
  phone: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((v) => v.length === 10 || v.length === 11, "Telefone com DDD (10 ou 11 dígitos)."),
  postalCode: z
    .string()
    .trim()
    .transform(onlyDigits)
    .refine((v) => v.length === 8, "CEP com 8 dígitos."),
  address: z.string().trim().min(2, "Informe o endereço.").max(120),
  addressNumber: z.string().trim().min(1, "Informe o número.").max(10),
  complement: z
    .string()
    .trim()
    .max(60)
    .optional()
    .transform((v) => (v ? v : undefined)),
  province: z.string().trim().min(2, "Informe o bairro.").max(80),
});

export type BillingProfileInput = z.input<typeof billingProfileSchema>;
export type BillingProfile = z.output<typeof billingProfileSchema>;

/** Linha de billing_profiles (snake_case) -> perfil. Null se faltar algum campo obrigatório. */
export function profileFromRow(row: Record<string, unknown> | null | undefined): BillingProfile | null {
  if (!row) return null;
  const parsed = billingProfileSchema.safeParse({
    legalName: row.legal_name,
    cpfCnpj: row.cpf_cnpj,
    email: row.email,
    phone: row.phone,
    postalCode: row.postal_code,
    address: row.address,
    addressNumber: row.address_number,
    complement: row.complement ?? undefined,
    province: row.province,
  });
  return parsed.success ? parsed.data : null;
}
