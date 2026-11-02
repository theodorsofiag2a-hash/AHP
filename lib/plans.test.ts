import { describe, expect, it } from "vitest";
import { PLANS, formatBrl, formatProjectRange, formatSimulations, formatValidity, installmentValue } from "./plans";

describe("catálogo de planos", () => {
  it("as faixas de projetos são contínuas e não se sobrepõem", () => {
    expect(PLANS[0].projectsMin).toBe(1);
    for (let i = 1; i < PLANS.length; i++) {
      expect(PLANS[i].projectsMin).toBe(PLANS[i - 1].projectsMax + 1);
      expect(PLANS[i].projectsMax).toBeGreaterThan(PLANS[i].projectsMin);
    }
  });

  it("preço cresce com a faixa e códigos são únicos", () => {
    const prices = PLANS.map((p) => p.priceBrl);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(new Set(PLANS.map((p) => p.code)).size).toBe(PLANS.length);
  });
});

describe("formatação", () => {
  it("parcela arredonda ao centavo", () => {
    expect(installmentValue(5000, 3)).toBe(1666.67);
    expect(installmentValue(10000, 3)).toBe(3333.33);
    expect(installmentValue(35000, 3)).toBe(11666.67);
    expect(installmentValue(50000, 3)).toBe(16666.67);
    expect(installmentValue(9000, 3)).toBe(3000);
  });

  it("moeda sem centavos quando inteira, com centavos quando não", () => {
    expect(formatBrl(5000).replace(/\s/g, " ")).toBe("R$ 5.000");
    expect(formatBrl(1666.67).replace(/\s/g, " ")).toBe("R$ 1.666,67");
  });

  it("textos de faixa, simulações e validade", () => {
    expect(formatProjectRange(PLANS[0])).toBe("1 a 10 projetos");
    expect(formatSimulations(PLANS[0])).toBe("Até 10 simulações");
    expect(formatSimulations(PLANS[1])).toBe("Simulações ilimitadas");
    expect(formatValidity(PLANS[0])).toBe("6 meses");
  });
});
