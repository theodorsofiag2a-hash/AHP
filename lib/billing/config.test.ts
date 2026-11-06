import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getPilotOrgSlugs, isBillingEnabled, isBillingEnabledFor } from "./config";

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

describe("organizações-piloto (BILLING_PILOT_ORGS)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("desligado geral: nenhuma organização, mesmo estando na lista", () => {
    vi.stubEnv("BILLING_ENABLED", "false");
    vi.stubEnv("BILLING_PILOT_ORGS", "acme");
    expect(isBillingEnabledFor("acme")).toBe(false);
  });

  it("ligado sem lista: todas as organizações", () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    vi.stubEnv("BILLING_PILOT_ORGS", "");
    expect(isBillingEnabledFor("qualquer")).toBe(true);
  });

  it("ligado com lista: só as listadas (ignora espaços e vazios)", () => {
    vi.stubEnv("BILLING_ENABLED", "true");
    vi.stubEnv("BILLING_PILOT_ORGS", " acme , beta,,");
    expect(isBillingEnabledFor("acme")).toBe(true);
    expect(isBillingEnabledFor("beta")).toBe(true);
    expect(isBillingEnabledFor("outra")).toBe(false);
    expect(getPilotOrgSlugs()).toEqual(["acme", "beta"]);
  });
});
