import { describe, expect, it } from "vitest";
import { GENERIC_SIGNUP_ERROR, signUpErrorMessage } from "./auth-errors";

describe("signUpErrorMessage", () => {
  it("explica o limite de envio", () => {
    expect(signUpErrorMessage({ status: 429 })).toContain("Aguarde alguns minutos");
    expect(signUpErrorMessage({ code: "over_email_send_rate_limit" })).toContain("Aguarde alguns minutos");
  });

  it("explica senha fraca e e-mail inválido", () => {
    expect(signUpErrorMessage({ code: "weak_password" })).toContain("Senha fraca");
    expect(signUpErrorMessage({ code: "email_address_invalid" })).toContain("e-mail não foi aceito");
  });

  it("não revela se o e-mail já tem conta", () => {
    expect(signUpErrorMessage({ code: "user_already_exists", status: 422 })).toBe(GENERIC_SIGNUP_ERROR);
    expect(signUpErrorMessage({ code: "email_exists" })).toBe(GENERIC_SIGNUP_ERROR);
    expect(signUpErrorMessage({})).toBe(GENERIC_SIGNUP_ERROR);
  });
});
