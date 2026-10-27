import { describe, expect, it } from "vitest";
import { busAutoValue, computeAutoFill, matchesRule, type AutoSubcriterion } from "./auto-fill";
import { parseAutoField, parseAutoMatch, toGridBus, type GridBus, type GridBusRow } from "./types";
import { assessViability, effectiveMargin } from "./viability";

// Exemplos baseados em linhas reais da Tabela 4-1 (NT-ONS DPL 0095/2026 Rev 0).
const bus = (overrides: Partial<GridBus> = {}): GridBus => ({
  id: "bus-1",
  uf: "BA",
  name: "Futura (FUT)",
  kv: 500,
  busMarginMw: 2165,
  subareaMarginMw: 1500,
  areaMarginMw: 3670,
  subareaExpr: null,
  areaExpr: null,
  notes: [],
  physicalClass: "A",
  bonified: true,
  tustG: 13.01,
  tusdG: null,
  transmissora: "AXIA Nordeste",
  ...overrides,
});

describe("effectiveMargin", () => {
  it("é o menor entre barramento, sub-área e área (limites não se somam)", () => {
    expect(effectiveMargin(bus())).toBe(1500);
  });
});

describe("assessViability", () => {
  it("barramento com margem, classe A e sem notas é 'attention' só se a sub-área limitar", () => {
    const result = assessViability(bus());
    expect(result.status).toBe("attention");
    expect(result.effectiveMarginMw).toBe(1500);
    expect(result.issues.map((i) => i.severity)).toEqual(["attention"]);
  });

  it("totalmente livre de restrição é 'ok'", () => {
    const result = assessViability(bus({ busMarginMw: 600, subareaMarginMw: 600, areaMarginMw: 600 }));
    expect(result.status).toBe("ok");
    expect(result.issues).toEqual([]);
  });

  it("margem zero no barramento é inviável", () => {
    const result = assessViability(bus({ busMarginMw: 0, subareaMarginMw: 0, areaMarginMw: 0 }));
    expect(result.status).toBe("inviable");
    expect(result.issues[0].text).toMatch(/Sem margem de escoamento/);
  });

  it("classe B é inviável mesmo com margem", () => {
    const result = assessViability(bus({ physicalClass: "B", notes: [5] }));
    expect(result.status).toBe("inviable");
    expect(result.issues.some((i) => /classe B/.test(i.text))).toBe(true);
  });

  it("margem zero e classe B não duplicam o motivo de potência", () => {
    const result = assessViability(bus({ busMarginMw: 0, subareaMarginMw: 0, areaMarginMw: 0, physicalClass: "B" }), 300);
    expect(result.issues.filter((i) => i.severity === "inviable")).toHaveLength(2);
    expect(result.issues.some((i) => /excede/.test(i.text))).toBe(false);
  });

  it("potência acima da margem efetiva é inviável; igual ou abaixo, não", () => {
    expect(assessViability(bus(), 1501).status).toBe("inviable");
    expect(assessViability(bus(), 1500).status).toBe("attention");
    expect(assessViability(bus(), null).status).toBe("attention");
  });

  it("barramento virtual (fora da Tabela 5-1) e notas viram atenção, não eliminação", () => {
    const result = assessViability(
      bus({ busMarginMw: 100, subareaMarginMw: 100, areaMarginMw: 100, physicalClass: null, notes: [1, 6] })
    );
    expect(result.status).toBe("attention");
    expect(result.issues.map((i) => i.text).join(" ")).toMatch(/Nota 1[\s\S]*Nota 6/);
  });
});

describe("matchesRule", () => {
  it("aplica limites numéricos com as chaves gt/gte/lt/lte", () => {
    expect(matchesRule(5, { lte: 5 })).toBe(true);
    expect(matchesRule(5.01, { gt: 5, lte: 6 })).toBe(true);
    expect(matchesRule(5, { gt: 5, lte: 6 })).toBe(false);
    expect(matchesRule(6, { gt: 5, lte: 6 })).toBe(true);
    expect(matchesRule(137, { lt: 138 })).toBe(true);
    expect(matchesRule(138, { lt: 138 })).toBe(false);
  });

  it("eq compara número ou booleano de forma estrita", () => {
    expect(matchesRule(230, { eq: 230 })).toBe(true);
    expect(matchesRule(500, { eq: 230 })).toBe(false);
    expect(matchesRule(true, { eq: true })).toBe(true);
    expect(matchesRule(false, { eq: true })).toBe(false);
  });

  it("valor ausente nunca casa, e limite numérico não casa com booleano", () => {
    expect(matchesRule(null, { lte: 5 })).toBe(false);
    expect(matchesRule(true, { gt: 1 })).toBe(false);
  });
});

describe("busAutoValue", () => {
  it("tarifa usa a TUST e, na falta dela, a TUSDg", () => {
    expect(busAutoValue(bus({ tustG: 13.01, tusdG: null }), "tariff_g")).toBe(13.01);
    expect(busAutoValue(bus({ tustG: null, tusdG: 6.71 }), "tariff_g")).toBe(6.71);
    expect(busAutoValue(bus({ tustG: null, tusdG: null }), "tariff_g")).toBeNull();
  });

  it("seccionamento vem da nota 2", () => {
    expect(busAutoValue(bus({ notes: [2] }), "is_sectioning")).toBe(true);
    expect(busAutoValue(bus({ notes: [6] }), "is_sectioning")).toBe(false);
  });
});

describe("computeAutoFill", () => {
  const subs: AutoSubcriterion[] = [
    {
      id: "tarifa",
      name: "TUSD/TUST",
      autoField: "tariff_g",
      scales: [
        { id: "t1", autoMatch: { lte: 5 } },
        { id: "t2", autoMatch: { gt: 5, lte: 6 } },
        { id: "t3", autoMatch: { gt: 6 } },
      ],
    },
    {
      id: "tensao",
      name: "Tensão",
      autoField: "kv",
      scales: [
        { id: "k1", autoMatch: { lt: 138 } },
        { id: "k2", autoMatch: { eq: 230 } },
        { id: "k3", autoMatch: { eq: 440 } },
      ],
    },
    {
      id: "beta",
      name: "Fator Beta",
      autoField: "bonified",
      scales: [
        { id: "b1", autoMatch: { eq: true } },
        { id: "b2", autoMatch: { eq: false } },
      ],
    },
    {
      id: "sin",
      name: "Interligação ao SIN",
      autoField: "is_sectioning",
      scales: [
        { id: "s1", autoMatch: { eq: true } },
        { id: "s2", autoMatch: null },
      ],
    },
  ];

  it("preenche tarifa e beta, e deixa tensão de 500 kV sem escala correspondente", () => {
    const result = computeAutoFill(bus(), subs);
    expect(result.selections).toEqual({ tarifa: "t3", beta: "b1" });
    expect(result.misses).toEqual([
      { subcriterionId: "tensao", name: "Tensão", reason: "no_scale" },
      { subcriterionId: "sin", name: "Interligação ao SIN", reason: "no_scale" },
    ]);
  });

  it("230 kV com seccionamento preenche tensão e interligação", () => {
    const result = computeAutoFill(bus({ kv: 230, notes: [2], bonified: false, tustG: 5.5 }), subs);
    expect(result.selections).toEqual({ tarifa: "t2", tensao: "k2", beta: "b2", sin: "s1" });
    expect(result.misses).toEqual([]);
  });

  it("sem tarifa conhecida, o subcritério fica para o usuário (no_data)", () => {
    const result = computeAutoFill(bus({ tustG: null, tusdG: null }), subs);
    expect(result.selections.tarifa).toBeUndefined();
    expect(result.misses.find((m) => m.subcriterionId === "tarifa")?.reason).toBe("no_data");
  });

  it("escalas ambíguas não são escolhidas", () => {
    const ambiguous: AutoSubcriterion[] = [
      { id: "x", name: "X", autoField: "kv", scales: [{ id: "a", autoMatch: { gte: 100 } }, { id: "b", autoMatch: { lte: 500 } }] },
    ];
    const result = computeAutoFill(bus(), ambiguous);
    expect(result.selections).toEqual({});
    expect(result.misses[0].reason).toBe("ambiguous");
  });
});

describe("parsers de metadados vindos do banco", () => {
  it("parseAutoMatch aceita só as chaves conhecidas", () => {
    expect(parseAutoMatch({ gt: 5, lte: 6 })).toEqual({ gt: 5, lte: 6 });
    expect(parseAutoMatch({ eq: true })).toEqual({ eq: true });
    expect(parseAutoMatch({ foo: 1 })).toBeNull();
    expect(parseAutoMatch({})).toBeNull();
    expect(parseAutoMatch(null)).toBeNull();
    expect(parseAutoMatch("x")).toBeNull();
  });

  it("parseAutoField rejeita valores fora da lista", () => {
    expect(parseAutoField("kv")).toBe("kv");
    expect(parseAutoField("drop table")).toBeNull();
    expect(parseAutoField(null)).toBeNull();
  });

  it("toGridBus converte numeric (string) e classe inválida", () => {
    const row: GridBusRow = {
      id: "1",
      uf: "BA",
      name: "X",
      kv: 230,
      bus_margin_mw: "340.00",
      subarea_margin_mw: "50.00",
      area_margin_mw: 50,
      subarea_expr: null,
      area_expr: null,
      notes: null,
      physical_class: "Z",
      bonified: true,
      tust_g: "11.63",
      tusd_g: null,
      transmissora: null,
    };
    const converted = toGridBus(row);
    expect(converted.busMarginMw).toBe(340);
    expect(converted.tustG).toBe(11.63);
    expect(converted.tusdG).toBeNull();
    expect(converted.notes).toEqual([]);
    expect(converted.physicalClass).toBeNull();
  });
});
