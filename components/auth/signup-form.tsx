"use client";

import { FormEvent, useState } from "react";
import { signUp } from "@/actions/auth";
import { Input, Label } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";
import { nativeValidityMessage } from "@/lib/form-validation";
import { cn } from "@/lib/utils";

export function SignupForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleInvalid(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    e.preventDefault();
    setErrors((prev) => ({ ...prev, [target.name]: nativeValidityMessage(target) }));
  }

  function handleInput(e: FormEvent<HTMLFormElement>) {
    const target = e.target as HTMLInputElement;
    if (!target.validity.valid || !(target.name in errors)) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next[target.name];
      return next;
    });
  }

  return (
    <form action={signUp} onInvalidCapture={handleInvalid} onInput={handleInput} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="organizationName">Nome da empresa</Label>
        <Input
          id="organizationName"
          name="organizationName"
          placeholder="Sua empresa"
          required
          className={cn(errors.organizationName && "border-danger")}
        />
        {errors.organizationName && <p className="text-xs text-danger">{errors.organizationName}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="voce@empresa.com"
          required
          className={cn(errors.email && "border-danger")}
        />
        {errors.email && <p className="text-xs text-danger">{errors.email}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Senha</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="Mínimo 8 caracteres"
          minLength={8}
          required
          className={cn(errors.password && "border-danger")}
        />
        {errors.password && <p className="text-xs text-danger">{errors.password}</p>}
      </div>
      <SubmitButton className="mt-2 w-full">Criar conta</SubmitButton>
    </form>
  );
}
