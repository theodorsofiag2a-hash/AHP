import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPilotEmails, isBillingEnabled, isBillingEnabledFor } from "./config";

describe("interruptor de cobrança (BILLING_ENABLED)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("fica desligado quando a variável não existe", () => {
    vi.stubEnv("BILLING_ENABLED", undefined);
    expect(isBillingEnabled()).toBe(false);
  });

  it("só liga com o valor exato 'true'", () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    expect(isBillingEnabled()).toBe(true);
  });

  it.each(["false", "TRUE", "1", "yes", " true", ""])("continua desligado com %j", (value) => {
    vi.stubEnv("BILLING_ENABLED", value);
    expect(isBillingEnabled()).toBe(false);
  });
});

describe("contas-piloto (BILLING_PILOT_EMAILS)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("desligado geral: nenhuma conta, mesmo estando na lista", () => {
    vi.stubEnv("BILLING_ENABLED", "false");
    vi.stubEnv("BILLING_PILOT_EMAILS", "acme@x.com");
    expect(isBillingEnabledFor("acme@x.com")).toBe(false);
  });

  it("ligado sem lista: todas as contas", () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    vi.stubEnv("BILLING_PILOT_EMAILS", "");
    expect(isBillingEnabledFor("qualquer@x.com")).toBe(true);
  });

  it("ligado com lista: só as listadas (ignora espaços e vazios)", () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    vi.stubEnv("BILLING_PILOT_EMAILS", " acme@x.com , Beta@x.com,,");
    expect(isBillingEnabledFor("acme@x.com")).toBe(true);
    expect(isBillingEnabledFor("beta@x.com")).toBe(true);
    expect(isBillingEnabledFor("outra@x.com")).toBe(false);
    expect(getPilotEmails()).toEqual(["acme@x.com", "beta@x.com"]);
  });
});
