import { describe, expect, it } from "vitest";
import { groupHref, groupModels, type ModelRow } from "./model-groups";

const m = (id: string, over: Partial<ModelRow> = {}): ModelRow => ({
  id,
  name: `Modelo ${id}`,
  updated_at: "2026-11-01T00:00:00Z",
  category: null,
  variant_label: null,
  ...over,
});

describe("groupModels", () => {
  it("junta as visões de projeto num cartão só e deixa Fornecedor antes", () => {
    const groups = groupModels([
      m("inv", { category: "projeto", variant_label: "Investidor" }),
      m("fab", { category: "fabricante" }),
      m("fab-proj", { category: "projeto", variant_label: "Fabricante" }),
    ]);
    expect(groups.map((g) => g.title)).toEqual(["Fornecedor", "Projeto"]);
    expect(groups[1].models.map((x) => x.variant_label)).toEqual(["Fabricante", "Investidor"]);
  });

  it("modelo sem categoria aparece sozinho, com o próprio nome, depois das categorias", () => {
    const groups = groupModels([
      m("a", { updated_at: "2026-10-01T00:00:00Z" }),
      m("b", { updated_at: "2026-11-10T00:00:00Z" }),
      m("p", { category: "projeto" }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["projeto", "model:b", "model:a"]);
  });

  it("a data do cartão é a do modelo mais recente do grupo", () => {
    const groups = groupModels([
      m("x", { category: "projeto", updated_at: "2026-11-02T00:00:00Z" }),
      m("y", { category: "projeto", updated_at: "2026-11-09T00:00:00Z" }),
    ]);
    expect(groups[0].updatedAt).toBe("2026-11-09T00:00:00Z");
  });

  it("categoria desconhecida cai como modelo avulso", () => {
    expect(groupModels([m("z", { category: "outra" })])[0].key).toBe("model:z");
  });
});

describe("groupHref", () => {
  it("uma visão só abre o modelo direto; várias abrem a lista da categoria", () => {
    const [single] = groupModels([m("s", { category: "fabricante" })]);
    expect(groupHref(single)).toBe("/models/s/alternatives");
    const [multi] = groupModels([m("1", { category: "projeto" }), m("2", { category: "projeto" })]);
    expect(groupHref(multi)).toBe("/models?categoria=projeto");
  });
});
