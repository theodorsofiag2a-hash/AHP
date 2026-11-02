import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, resetPasswordSchema } from "./password";

describe("forgotPasswordSchema", () => {
  it("aceita e-mail válido e apara espaços", () => {
    expect(forgotPasswordSchema.parse({ email: "  a@b.com " }).email).toBe("a@b.com");
  });
  it("rejeita vazio e formato inválido", () => {
    expect(forgotPasswordSchema.safeParse({ email: "" }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: "abc" }).success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("aceita senhas iguais com 8+ caracteres", () => {
    expect(resetPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345678" }).success).toBe(true);
  });
  it("rejeita senha curta", () => {
    const r = resetPasswordSchema.safeParse({ password: "1234567", confirmPassword: "1234567" });
    expect(r.success).toBe(false);
  });
  it("rejeita confirmação diferente", () => {
    const r = resetPasswordSchema.safeParse({ password: "12345678", confirmPassword: "12345679" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe("As senhas não coincidem.");
  });
});
