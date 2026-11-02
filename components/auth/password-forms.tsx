"use client";

import { FormEvent, useState } from "react";
import { requestPasswordReset, updatePassword } from "@/actions/auth";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { nativeValidityMessage } from "@/lib/form-validation";
import { cn } from "@/lib/utils";

function useFieldErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function onInvalid(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    e.preventDefault();
    setErrors((prev) => ({ ...prev, [target.name]: nativeValidityMessage(target) }));
  }

  function onInput(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    if (!target.validity.valid || !(target.name in errors)) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[target.name];
      return next;
    });
  }

  return { errors, onInvalid, onInput };
}

export function ForgotPasswordForm() {
  const { errors, onInvalid, onInput } = useFieldErrors();

  return (
    <form action={requestPasswordReset} onInvalidCapture={onInvalid} onInput={onInput} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="voce@empresa.com"
          autoComplete="email"
          required
          className={cn(errors.email && "border-danger")}
        />
        {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
      </div>
      <SubmitButton className="mt-2 w-full">Enviar link de redefinição</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const { errors, onInvalid, onInput } = useFieldErrors();

  return (
    <form action={updatePassword} onInvalidCapture={onInvalid} onInput={onInput} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Nova senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          minLength={8}
          required
          className={cn(errors.password && "border-danger")}
        />
        {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          placeholder="Repita a senha"
          autoComplete="new-password"
          minLength={8}
          required
          className={cn(errors.confirmPassword && "border-danger")}
        />
        {errors.confirmPassword && <p className="text-xs text-danger">{errors.confirmPassword}</p>}
      </div>
      <SubmitButton className="mt-2 w-full">Salvar nova senha</SubmitButton>
    </form>
  );
}
