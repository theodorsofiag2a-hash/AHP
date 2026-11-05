import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isBillingEnabled } from "./config";

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
