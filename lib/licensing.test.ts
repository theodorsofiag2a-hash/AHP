import { describe, expect, it } from "vitest";
import { isProvisionalRite, isRite, pickScaleByKey } from "./licensing";

describe("licenciamento", () => {
  it("só rito indefinido é provisório", () => {
    expect(isProvisionalRite("em_consulta")).toBe(true);
    expect(isProvisionalRite("em_elaboracao")).toBe(true);
    expect(isProvisionalRite("nao_informado")).toBe(true);
    expect(isProvisionalRite("dispensa")).toBe(false);
    expect(isProvisionalRite("simplificado")).toBe(false);
    expect(isProvisionalRite("trifasico")).toBe(false);
  });

  it("reconhece os seis ritos", () => {
    expect(isRite("trifasico")).toBe(true);
    expect(isRite("Trifásico")).toBe(false);
    expect(isRite(null)).toBe(false);
  });

  it("acha a faixa pela chave", () => {
    const scales = [{ auto_key: "dispensa", id: 1 }, { auto_key: "trifasico", id: 2 }, { auto_key: null, id: 3 }];
    expect(pickScaleByKey("trifasico", scales)?.id).toBe(2);
    expect(pickScaleByKey("em_consulta", scales)).toBeNull();
  });
});
