import { describe, expect, it } from "vitest";
import { billingProfileSchema, profileFromRow } from "./billing-profile";
import { isValidCnpj, isValidCpf, isValidCpfCnpj, onlyDigits } from "./document";
import {
  MODALITIES,
  buildCheckoutPayload,
  isAsaasCheckoutLink,
  isPurchaseModality,
  itemName,
  normalizeAppUrl,
  todayInSaoPaulo,
} from "./purchase";

const profile = billingProfileSchema.parse({
  legalName: "Empresa Teste Ltda",
  cpfCnpj: "11.222.333/0001-81",
  email: "Financeiro@Empresa.com",
  phone: "(47) 99999-8888",
  postalCode: "89010-000",
  address: "Rua Teste",
  addressNumber: "100",
  province: "Centro",
});

const plan = { code: "P1", name: "Entrada", priceCents: 500000, maxInstallments: 3, validityMonths: 6 };
const baseArgs = { orderId: "ord-1", plan, profile, appUrl: "https://ahp-pi-three.vercel.app/", imageBase64: "AAA" };

describe("CPF e CNPJ", () => {
  it("valida com dígitos verificadores", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCpfCnpj("52998224725")).toBe(true);
    expect(isValidCpfCnpj("11222333000181")).toBe(true);
  });

  it("recusa dígito errado, repetidos e tamanho errado", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCnpj("00.000.000/0000-00")).toBe(false);
    expect(isValidCpfCnpj("123")).toBe(false);
    expect(isValidCpfCnpj("")).toBe(false);
  });

  it("onlyDigits tira a pontuação", () => {
    expect(onlyDigits("11.222.333/0001-81")).toBe("11222333000181");
  });
});

describe("dados de cobrança", () => {
  it("normaliza: só dígitos em CNPJ/telefone/CEP e e-mail em minúsculas", () => {
    expect(profile).toMatchObject({
      cpfCnpj: "11222333000181",
      phone: "47999998888",
      postalCode: "89010000",
      email: "financeiro@empresa.com",
    });
  });

  it("recusa CNPJ inválido, telefone sem DDD e CEP curto", () => {
    const input = { ...profile, cpfCnpj: "11222333000182" };
    expect(billingProfileSchema.safeParse(input).success).toBe(false);
    expect(billingProfileSchema.safeParse({ ...profile, phone: "999998888" }).success).toBe(false);
    expect(billingProfileSchema.safeParse({ ...profile, postalCode: "8901000" }).success).toBe(false);
  });

  it("complemento é opcional; o resto é obrigatório", () => {
    expect(billingProfileSchema.safeParse({ ...profile, province: "" }).success).toBe(false);
    expect(billingProfileSchema.safeParse({ ...profile, complement: "" }).success).toBe(true);
  });

  it("lê a linha do banco; incompleta vira null (compra bloqueada até preencher)", () => {
    const row = {
      legal_name: "Empresa Teste Ltda",
      cpf_cnpj: "11222333000181",
      email: "a@b.com",
      phone: "4733334444",
      postal_code: "89010000",
      address: "Rua Teste",
      address_number: "100",
      province: "Centro",
      complement: null,
    };
    expect(profileFromRow(row)?.cpfCnpj).toBe("11222333000181");
    expect(profileFromRow({ ...row, phone: null })).toBeNull();
    expect(profileFromRow(null)).toBeNull();
  });
});

describe("payload do Checkout", () => {
  it("Pix: só Pix, à vista, sem assinatura nem parcelas", () => {
    const p = buildCheckoutPayload({ ...baseArgs, modality: "pix" });
    expect(p.billingTypes).toEqual(["PIX"]);
    expect(p.chargeTypes).toEqual(["DETACHED"]);
    expect(p).not.toHaveProperty("subscription");
    expect(p).not.toHaveProperty("installment");
  });

  it("cartão em até 3x: DETACHED + INSTALLMENT com máximo de 3 parcelas", () => {
    const p = buildCheckoutPayload({ ...baseArgs, modality: "card_installments" });
    expect(p.billingTypes).toEqual(["CREDIT_CARD"]);
    expect(p.chargeTypes).toEqual(["DETACHED", "INSTALLMENT"]);
    expect(p).toMatchObject({ installment: { maxInstallmentCount: 3 } });
  });

  it("cartão recorrente: RECURRENT sozinho (não combina com outros), semestral, começa hoje, sem endDate", () => {
    const p = buildCheckoutPayload({ ...baseArgs, modality: "card_recurrent", now: new Date("2026-11-06T15:00:00Z") });
    expect(p.chargeTypes).toEqual(["RECURRENT"]);
    expect(p).toMatchObject({ subscription: { cycle: "SEMIANNUALLY", nextDueDate: "2026-11-06" } });
    expect((p as { subscription: object }).subscription).not.toHaveProperty("endDate");
  });

  it("o id do pedido vai como externalReference e o valor sai em reais", () => {
    const p = buildCheckoutPayload({ ...baseArgs, modality: "pix" });
    expect(p.externalReference).toBe("ord-1");
    expect(p.items[0].value).toBe(5000);
    expect(p.items[0].quantity).toBe(1);
    expect(p.items[0].imageBase64).toBe("AAA");
  });

  it("callbacks usam o domínio sem barra final", () => {
    const p = buildCheckoutPayload({ ...baseArgs, modality: "pix" });
    expect(p.callback).toEqual({
      successUrl: "https://ahp-pi-three.vercel.app/billing?checkout=sucesso",
      cancelUrl: "https://ahp-pi-three.vercel.app/billing?checkout=cancelado",
      expiredUrl: "https://ahp-pi-three.vercel.app/billing?checkout=expirado",
    });
  });

  it("customerData completo, com phone (não phoneNumber) e sem complemento vazio", () => {
    const p = buildCheckoutPayload({ ...baseArgs, modality: "pix" });
    expect(p.customerData).toEqual({
      name: "Empresa Teste Ltda",
      cpfCnpj: "11222333000181",
      email: "financeiro@empresa.com",
      phone: "47999998888",
      postalCode: "89010000",
      address: "Rua Teste",
      addressNumber: "100",
      province: "Centro",
    });
    const comComplemento = buildCheckoutPayload({ ...baseArgs, profile: { ...profile, complement: "Sala 2" }, modality: "pix" });
    expect(comComplemento.customerData).toHaveProperty("complement", "Sala 2");
  });

  it("nome do item respeita o limite de 30 caracteres do Asaas", () => {
    expect(itemName({ code: "P4", name: "Corporativo" })).toBe("AHP Corporativo (P4)");
    expect(itemName({ code: "P9", name: "N".repeat(60) }).length).toBeLessThanOrEqual(30);
  });

  it("recusa URL do app ausente ou inválida", () => {
    expect(() => normalizeAppUrl(undefined)).toThrow();
    expect(() => normalizeAppUrl("ahp.com")).toThrow();
    expect(normalizeAppUrl(" https://x.com/// ")).toBe("https://x.com");
  });

  it("data de hoje no fuso de São Paulo (22h em SP já é o dia seguinte em UTC)", () => {
    expect(todayInSaoPaulo(new Date("2026-11-07T01:30:00Z"))).toBe("2026-11-06");
    expect(todayInSaoPaulo(new Date("2026-11-06T12:00:00Z"))).toBe("2026-11-06");
  });
});

describe("modalidades e link do checkout", () => {
  it("só cartão tem renovação automática; Pix não", () => {
    expect(MODALITIES.pix.autoRenew).toBe(false);
    expect(MODALITIES.card_recurrent.autoRenew).toBe(true);
    expect(MODALITIES.card_installments.autoRenew).toBe(true);
  });

  it("reconhece só modalidades válidas", () => {
    expect(isPurchaseModality("pix")).toBe(true);
    expect(isPurchaseModality("boleto")).toBe(false);
    expect(isPurchaseModality(undefined)).toBe(false);
  });

  it("aceita só link https do Asaas (sandbox ou produção)", () => {
    expect(isAsaasCheckoutLink("https://sandbox.asaas.com/000/checkoutSession/show/abc")).toBe(true);
    expect(isAsaasCheckoutLink("https://www.asaas.com/checkoutSession/show/abc")).toBe(true);
    expect(isAsaasCheckoutLink("http://sandbox.asaas.com/x")).toBe(false);
    expect(isAsaasCheckoutLink("https://asaas.com.evil.com/x")).toBe(false);
    expect(isAsaasCheckoutLink("https://evilasaas.com/x")).toBe(false);
    expect(isAsaasCheckoutLink("javascript:alert(1)")).toBe(false);
    expect(isAsaasCheckoutLink(undefined)).toBe(false);
  });
});
