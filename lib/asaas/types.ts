/** Ambientes do Asaas. Cada um tem URL e prefixo de chave próprios. */
export type AsaasEnv = "sandbox" | "production";

/** Campos usados da cobrança (GET /payments/{id}). O Asaas devolve mais; só tipamos o que lemos. */
export type AsaasPayment = {
  id: string;
  customer: string;
  /** Em reais (decimal). Converter para centavos com toCents(). */
  value: number;
  netValue?: number | null;
  billingType: string;
  status: string;
  dueDate: string;
  confirmedDate?: string | null;
  paymentDate?: string | null;
  creditDate?: string | null;
  installment?: string | null;
  installmentNumber?: number | null;
  subscription?: string | null;
  /** Id do checkout de origem. O externalReference do checkout NÃO chega aqui. */
  checkoutSession?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
  creditCard?: {
    creditCardBrand?: string | null;
    creditCardNumber?: string | null;
    creditCardToken?: string | null;
  } | null;
};

export type AsaasInstallment = {
  id: string;
  paymentCount?: number;
  value?: number;
  totalValue?: number;
  customer?: string;
  externalReference?: string | null;
  creditCard?: AsaasPayment["creditCard"];
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: string;
  cycle: string;
  value: number;
  nextDueDate?: string | null;
  externalReference?: string | null;
  deleted?: boolean;
  creditCard?: AsaasPayment["creditCard"];
};

/** Formato de erro da API: { errors: [{ code, description }] }. */
export type AsaasApiErrorItem = { code: string; description: string };

/** Envelope de um webhook. O corpo varia por evento; `payment`/`checkout` aparecem conforme o tipo. */
export type AsaasWebhookEnvelope = {
  id: string;
  event: string;
  dateCreated?: string;
  payment?: Partial<AsaasPayment> & { id?: string };
  checkout?: { id?: string } & Record<string, unknown>;
  subscription?: Partial<AsaasSubscription> & { id?: string };
} & Record<string, unknown>;

/** Reais (decimal do Asaas) -> centavos inteiros, sem erro de ponto flutuante. */
export function toCents(valueInReais: number): number {
  return Math.round(valueInReais * 100);
}
