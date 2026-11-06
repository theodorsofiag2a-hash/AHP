"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveBillingProfile } from "@/actions/billing-profile";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export type BillingProfileFormValues = {
  legalName: string;
  cpfCnpj: string;
  email: string;
  phone: string;
  postalCode: string;
  address: string;
  addressNumber: string;
  complement: string;
  province: string;
};

export const EMPTY_BILLING_PROFILE: BillingProfileFormValues = {
  legalName: "",
  cpfCnpj: "",
  email: "",
  phone: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  complement: "",
  province: "",
};

type FieldDef = { key: keyof BillingProfileFormValues; label: string; placeholder?: string; type?: string; wide?: boolean; optional?: boolean };

const FIELDS: FieldDef[] = [
  { key: "legalName", label: "Razão social ou nome", wide: true },
  { key: "cpfCnpj", label: "CNPJ ou CPF", placeholder: "00.000.000/0000-00" },
  { key: "email", label: "E-mail financeiro", type: "email", placeholder: "financeiro@empresa.com.br" },
  { key: "phone", label: "Telefone com DDD", placeholder: "(47) 99999-9999" },
  { key: "postalCode", label: "CEP", placeholder: "00000-000" },
  { key: "address", label: "Endereço", wide: true },
  { key: "addressNumber", label: "Número" },
  { key: "complement", label: "Complemento", optional: true },
  { key: "province", label: "Bairro" },
];

export function BillingProfileForm({ initial }: { initial: BillingProfileFormValues }) {
  const [values, setValues] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveBillingProfile(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Dados de cobrança salvos.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {FIELDS.map((field) => (
        <div key={field.key} className={`flex flex-col gap-1.5 ${field.wide ? "sm:col-span-2" : ""}`}>
          <Label htmlFor={`bp-${field.key}`}>
            {field.label}
            {field.optional ? " (opcional)" : ""}
          </Label>
          <Input
            id={`bp-${field.key}`}
            type={field.type ?? "text"}
            value={values[field.key]}
            placeholder={field.placeholder}
            onChange={(e) => setValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
            required={!field.optional}
            disabled={isPending}
          />
        </div>
      ))}
      <div className="sm:col-span-2">
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar dados de cobrança
        </Button>
      </div>
    </form>
  );
}
