import { describe, expect, it } from "vitest";
import { alternativeNoun } from "./alternative-noun";

describe("alternativeNoun", () => {
  it("modelos de projeto avaliam projetos", () => {
    expect(alternativeNoun("projeto")).toMatchObject({ singular: "projeto", example: "Projeto A" });
  });
  it("modelo Fornecedor avalia fornecedores", () => {
    expect(alternativeNoun("fabricante")).toMatchObject({ plural: "fornecedores", example: "Fornecedor A" });
  });
  it("sem categoria, alternativa", () => {
    expect(alternativeNoun(null)).toMatchObject({ singular: "alternativa", article: "a" });
  });
});
