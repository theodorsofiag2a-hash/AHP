import type { BillingProfile } from "./billing-profile";

/**
 * Modalidades de compra (resultado dos spikes do Sandbox):
 *  - pix: Pix à vista. Sem renovação automática (renova por novo checkout, com lembrete).
 *  - card_recurrent: cartão à vista com renovação automática (RECURRENT, a cada 6 meses).
 *  - card_installments: cartão à vista ou em até 3x (DETACHED + INSTALLMENT). A renovação automática é
 *    criada depois, pelo webhook, com o token do cartão (RECURRENT não combina com outros tipos).
 */
export const PURCHASE_MODALITIES = ["pix", "card_recurrent", "card_installments"] as const;
export type PurchaseModality = (typeof PURCHASE_MODALITIES)[number];

export type ModalityInfo = {
  label: string;
  description: string;
  paymentMethod: "PIX" | "CREDIT_CARD";
  /** Máximo de parcelas oferecidas ao pagador no checkout. */
  maxInstallments: (planMax: number) => number;
  autoRenew: boolean;
};

export const MODALITIES: Record<PurchaseModality, ModalityInfo> = {
  pix: {
    label: "Pix à vista",
    description: "Pagamento imediato. Ao fim dos 6 meses você recebe um lembrete para renovar.",
    paymentMethod: "PIX",
    maxInstallments: () => 1,
    autoRenew: false,
  },
  card_recurrent: {
    label: "Cartão à vista, com renovação automática",
    description: "Cobrança no cartão agora e a cada 6 meses, até você cancelar.",
    paymentMethod: "CREDIT_CARD",
    maxInstallments: () => 1,
    autoRenew: true,
  },
  card_installments: {
    label: "Cartão em até 3x, com renovação automática",
    description: "Você escolhe à vista ou parcelado no pagamento. A renovação, a cada 6 meses, é cobrada no mesmo cartão.",
    paymentMethod: "CREDIT_CARD",
    maxInstallments: (planMax) => planMax,
    autoRenew: true,
  },
};

export function isPurchaseModality(value: unknown): value is PurchaseModality {
  return typeof value === "string" && (PURCHASE_MODALITIES as readonly string[]).includes(value);
}

export const CHECKOUT_MINUTES_TO_EXPIRE = 60;
const ITEM_NAME_MAX = 30; // limite do Asaas para o nome do item

export type CheckoutPlan = { code: string; name: string; priceCents: number; maxInstallments: number; validityMonths: number };

/** Data (AAAA-MM-DD) no fuso de São Paulo: o Asaas interpreta nextDueDate como data local. */
export function todayInSaoPaulo(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** URL base do app sem barra final; recusa valor ausente (os callbacks do Asaas precisam de domínio fixo). */
export function normalizeAppUrl(raw: string | undefined): string {
  const url = (raw ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/]+/.test(url)) throw new Error("NEXT_PUBLIC_APP_URL ausente ou inválida.");
  return url;
}

export function itemName(plan: Pick<CheckoutPlan, "code" | "name">): string {
  return `AHP ${plan.name} (${plan.code})`.slice(0, ITEM_NAME_MAX);
}

/** Corpo do POST /v3/checkouts. Puro: tudo que varia entra por parâmetro. */
export function buildCheckoutPayload(args: {
  orderId: string;
  plan: CheckoutPlan;
  modality: PurchaseModality;
  profile: BillingProfile;
  appUrl: string;
  imageBase64: string;
  now?: Date;
}) {
  const { orderId, plan, modality, profile, imageBase64 } = args;
  const info = MODALITIES[modality];
  const appUrl = normalizeAppUrl(args.appUrl);

  const base = {
    minutesToExpire: CHECKOUT_MINUTES_TO_EXPIRE,
    externalReference: orderId,
    callback: {
      successUrl: `${appUrl}/billing?checkout=sucesso`,
      cancelUrl: `${appUrl}/billing?checkout=cancelado`,
      expiredUrl: `${appUrl}/billing?checkout=expirado`,
    },
    items: [
      {
        name: itemName(plan),
        description: `Plano AHP ${plan.name} - ${plan.validityMonths} meses`.slice(0, 150),
        quantity: 1,
        value: plan.priceCents / 100,
        imageBase64,
      },
    ],
    // O Asaas exige todos estes campos quando customerData é enviado. O campo de telefone é "phone".
    customerData: {
      name: profile.legalName,
      cpfCnpj: profile.cpfCnpj,
      email: profile.email,
      phone: profile.phone,
      postalCode: profile.postalCode,
      address: profile.address,
      addressNumber: profile.addressNumber,
      province: profile.province,
      ...(profile.complement ? { complement: profile.complement } : {}),
    },
  };

  switch (modality) {
    case "pix":
      return { ...base, billingTypes: ["PIX"], chargeTypes: ["DETACHED"] };
    case "card_recurrent":
      return {
        ...base,
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["RECURRENT"],
        // 1ª cobrança hoje; sem endDate, a assinatura segue até ser cancelada.
        subscription: { cycle: "SEMIANNUALLY", nextDueDate: todayInSaoPaulo(args.now) },
      };
    case "card_installments":
      return {
        ...base,
        billingTypes: ["CREDIT_CARD"],
        chargeTypes: ["DETACHED", "INSTALLMENT"],
        installment: { maxInstallmentCount: info.maxInstallments(plan.maxInstallments) },
      };
  }
}

/** Confere que o link devolvido pelo Asaas é mesmo do Asaas antes de redirecionar o usuário. */
export function isAsaasCheckoutLink(link: unknown): link is string {
  if (typeof link !== "string") return false;
  try {
    const url = new URL(link);
    return url.protocol === "https:" && (url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com"));
  } catch {
    return false;
  }
}
