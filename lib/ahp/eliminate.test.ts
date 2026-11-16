import { describe, expect, it } from "vitest";
import { findEliminated } from "./eliminate";

describe("findEliminated", () => {
  const names = new Map([
    ["tipoB", "Restrição tipo B no barramento"],
    ["outro", "Outro critério"],
  ]);

  it("elimina quem escolheu a faixa eliminatória e guarda o motivo", () => {
    const out = findEliminated(
      [
        { alternative_id: "a", subcriterion_id: "tipoB", scale_id: "s-elim" },
        { alternative_id: "b", subcriterion_id: "tipoB", scale_id: "s-ok" },
      ],
      new Set(["s-elim"]),
      names
    );
    expect([...out.keys()]).toEqual(["a"]);
    expect(out.get("a")).toEqual(["Restrição tipo B no barramento"]);
  });

  it("junta vários motivos, sem repetir", () => {
    const out = findEliminated(
      [
        { alternative_id: "a", subcriterion_id: "tipoB", scale_id: "x" },
        { alternative_id: "a", subcriterion_id: "outro", scale_id: "y" },
      ],
      new Set(["x", "y"]),
      names
    );
    expect(out.get("a")).toEqual(["Restrição tipo B no barramento", "Outro critério"]);
  });

  it("sem faixa eliminatória, ninguém sai", () => {
    expect(findEliminated([{ alternative_id: "a", subcriterion_id: "tipoB", scale_id: "s" }], new Set(), names).size).toBe(0);
  });
});
