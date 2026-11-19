import { describe, expect, it } from "vitest";
import { reportAppliesToModel } from "./applies";

describe("reportAppliesToModel", () => {
  it("vale para os modelos de projeto, qualquer que seja o nome", () => {
    expect(reportAppliesToModel({ category: "projeto" })).toBe(true);
  });

  it("não vale para Fornecedor nem para modelo sem categoria", () => {
    expect(reportAppliesToModel({ category: "fabricante" })).toBe(false);
    expect(reportAppliesToModel({ category: null })).toBe(false);
  });
});
