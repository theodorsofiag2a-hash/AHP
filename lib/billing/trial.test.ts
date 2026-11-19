import { describe, expect, it } from "vitest";
import { isTrialBilling } from "./trial";
import type { BillingSummary } from "./plan-summary";

describe("isTrialBilling", () => {
  it("sem plano e sem créditos é trial", () => {
    expect(isTrialBilling({ mode: "legacy", creditBalance: 0 })).toBe(true);
  });

  it("com créditos não é trial", () => {
    expect(isTrialBilling({ mode: "legacy", creditBalance: 3 })).toBe(false);
  });

  it("com plano não é trial", () => {
    expect(isTrialBilling({ mode: "plan" } as BillingSummary)).toBe(false);
  });
});
