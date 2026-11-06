"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startPlanPurchase } from "@/actions/plans";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { MODALITIES, PURCHASE_MODALITIES, type PurchaseModality } from "@/lib/billing/purchase";
import { formatBrl, installmentValue, type Plan } from "@/lib/plans";

export type PurchaseBlock = "no_profile" | "not_admin" | "has_plan" | "open_order" | null;

const BLOCK_MESSAGES: Record<Exclude<PurchaseBlock, null>, string> = {
  no_profile: "Antes de contratar, preencha os dados de cobrança da organização.",
  not_admin: "Apenas proprietários e administradores podem contratar um plano.",
  has_plan: "Sua organização já possui um plano. Para renovar ou trocar, fale com a G2A.",
  open_order: "Você já tem um pagamento em andamento. Conclua-o no aviso acima.",
};

export function PurchaseButton({ plan, block }: { plan: Plan; block: PurchaseBlock }) {
  const [open, setOpen] = useState(false);
  const [modality, setModality] = useState<PurchaseModality>("pix");
  const [accepted, setAccepted] = useState(false);
  const [isPending, startTransition] = useTransition();

  const info = MODALITIES[modality];
  const needsAcceptance = info.autoRenew;
  const canSubmit = !isPending && (!needsAcceptance || accepted);

  function handleSubmit() {
    startTransition(async () => {
      const result = await startPlanPurchase({ planCode: plan.code, modality, acceptedRenewal: accepted });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      // Segue para a página de pagamento do Asaas. O plano só é ativado depois da confirmação do pagamento.
      window.location.assign(result.url);
    });
  }

  if (block) {
    return (
      <div className="flex flex-col gap-2">
        <Button size="sm" disabled>
          Contratar
        </Button>
        <p className="text-xs text-text-muted">{BLOCK_MESSAGES[block]}</p>
        {block === "no_profile" && (
          <Link href="/settings/organization" className="text-xs font-medium text-gold-700 underline">
            Preencher dados de cobrança
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Contratar
      </Button>

      <Dialog
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title={`Contratar plano ${plan.name}`}
        description={`${formatBrl(plan.priceBrl)} · válido por ${plan.validityMonths} meses`}
      >
        <div className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2" disabled={isPending}>
            <legend className="mb-1 text-sm font-medium text-text-primary">Como você quer pagar?</legend>
            {PURCHASE_MODALITIES.map((value) => {
              const item = MODALITIES[value];
              return (
                <label
                  key={value}
                  className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors ${
                    modality === value ? "border-gold-600 bg-gold-soft" : "border-border-subtle hover:bg-bg-surface-alt"
                  }`}
                >
                  <input
                    type="radio"
                    name="modality"
                    value={value}
                    checked={modality === value}
                    onChange={() => {
                      setModality(value);
                      setAccepted(false);
                    }}
                    className="mt-1 accent-[var(--color-gold-600,#b8892a)]"
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium text-text-primary">{item.label}</span>
                    <span className="text-text-muted">{item.description}</span>
                    {value === "card_installments" && (
                      <span className="text-text-muted tabular-nums">
                        Em até {plan.maxInstallments}x de {formatBrl(installmentValue(plan.priceBrl, plan.maxInstallments))}
                      </span>
                    )}
                  </span>
                </label>
              );
            })}
          </fieldset>

          {needsAcceptance && (
            <label className="flex cursor-pointer items-start gap-3 text-sm text-text-primary">
              <Checkbox checked={accepted} onChange={(e) => setAccepted(e.target.checked)} disabled={isPending} />
              <span>
                Concordo que o plano seja renovado automaticamente a cada {plan.validityMonths} meses, com cobrança de{" "}
                <strong className="tabular-nums">{formatBrl(plan.priceBrl)}</strong> no mesmo cartão, até eu cancelar. Para cancelar a
                renovação, basta avisar a G2A.
              </span>
            </label>
          )}

          <p className="text-xs text-text-faint">
            Você será levado à página segura do Asaas para pagar. O plano é liberado assim que o pagamento for confirmado.
          </p>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ir para o pagamento
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
