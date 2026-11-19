"use client";

import { FormEvent, useState } from "react";
import { signUp } from "@/actions/auth";
import { Input, Label } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { nativeValidityMessage } from "@/lib/form-validation";
import { cn } from "@/lib/utils";

const MISMATCH = "As senhas não coincidem.";

export function SignupForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  function handleInvalid(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    e.preventDefault();
    setErrors((prev) => ({ ...prev, [target.name]: nativeValidityMessage(target) }));
  }

  function clearError(name: string) {
    setErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function handleInput(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    if (target.name === "confirmPassword" || target.name === "password") return;
    if (!target.validity.valid) return;
    clearError(target.name);
  }

  // Confirmação: só acusa a diferença depois que a pessoa termina de digitar (ao sair do campo ou ao enviar).
  function checkMatch(nextPassword = password, nextConfirm = confirmPassword) {
    if (nextConfirm && nextPassword !== nextConfirm) {
      setErrors((prev) => ({ ...prev, confirmPassword: MISMATCH }));
      return false;
    }
    clearError("confirmPassword");
    return true;
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault();
      setErrors((prev) => ({ ...prev, confirmPassword: MISMATCH }));
    }
  }

  return (
    <form
      action={signUp}
      onSubmit={handleSubmit}
      onInvalidCapture={handleInvalid}
      onInput={handleInput}
      className="flex flex-col gap-4"
    >
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
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <PasswordInput
          id="password"
          name="password"
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (e.target.validity.valid) clearError("password");
            if (errors.confirmPassword) checkMatch(e.target.value);
          }}
          className={cn(errors.password && "border-danger")}
        />
        {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="confirmPassword">Digite a senha novamente</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          placeholder="Repita a senha"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmPassword}
          onChange={(e) => {
            setConfirmPassword(e.target.value);
            // Corrige o aviso assim que as duas ficam iguais.
            if (errors.confirmPassword && e.target.value === password) clearError("confirmPassword");
          }}
          onBlur={() => checkMatch()}
          onPaste={(e) => e.preventDefault()}
          className={cn(errors.confirmPassword && "border-danger")}
        />
        {errors.confirmPassword && <p className="text-xs text-danger">{errors.confirmPassword}</p>}
      </div>
      <SubmitButton className="mt-2 w-full">Criar conta</SubmitButton>
    </form>
  );
}
