import { z } from "zod";

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Informe seu e-mail.").email("E-mail inválido."),
});

// Mesmo mínimo do cadastro (signUpSchema em actions/auth.ts).
export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa de pelo menos 8 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

/** Cookie que liga o pedido de redefinição ao retorno do link, sem depender de query string no redirect do Supabase. */
export const RECOVERY_COOKIE = "pw_recovery";
export const RECOVERY_COOKIE_PATH = "/auth";
export const RECOVERY_COOKIE_MAX_AGE_SECONDS = 60 * 60;
