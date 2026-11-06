import { describe, expect, it } from "vitest";
import { EMPTY_GATES, assessGates, isEliminated, toGateValues } from "./gates";

describe("assessGates", () => {
  it("todos atendidos = passed", () => {
    const r = assessGates({ rte: true, deadline: true, auction: true, technical: true });
    expect(r).toEqual({ status: "passed", failed: [], pending: [] });
  });

  it("qualquer 'não atende' elimina, mesmo com os outros pendentes", () => {
    const r = assessGates({ rte: false, deadline: null, auction: true, technical: null });
    expect(r.status).toBe("eliminated");
    expect(r.failed).toEqual(["rte"]);
    expect(r.pending).toEqual(["deadline", "technical"]);
  });

  it("sem reprovação mas com resposta faltando = pending (não elimina)", () => {
    expect(assessGates({ rte: true, deadline: null, auction: true, technical: true }).status).toBe("pending");
    expect(assessGates(EMPTY_GATES).status).toBe("pending");
  });
});

describe("toGateValues / isEliminated", () => {
  it("campos ausentes viram pendente", () => {
    expect(toGateValues({})).toEqual(EMPTY_GATES);
  });
  it("lê as colunas do banco", () => {
    expect(isEliminated({ gate_auction: false })).toBe(true);
    expect(isEliminated({ gate_auction: true, gate_rte: null })).toBe(false);
  });
});
