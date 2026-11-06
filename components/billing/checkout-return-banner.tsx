"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export type CheckoutReturn = "sucesso" | "cancelado" | "expirado";

const POLL_MS = 5000;
const MAX_POLLS = 24; // ~2 minutos

/**
 * Aviso exibido quando o Asaas devolve o usuário ao app (/billing?checkout=...). O retorno NUNCA ativa o
 * plano: quem ativa é o webhook. No sucesso, a página se atualiza sozinha por ~2 minutos esperando a confirmação.
 */
export function CheckoutReturnBanner({ status, planActive }: { status: CheckoutReturn; planActive: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (status !== "sucesso" || planActive) return;
    let polls = 0;
    const timer = setInterval(() => {
      polls += 1;
      router.refresh();
      if (polls >= MAX_POLLS) clearInterval(timer);
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [status, planActive, router]);

  if (status === "sucesso") {
    return planActive ? (
      <Banner icon={<CheckCircle2 className="h-5 w-5 text-success" />} title="Pagamento confirmado" text="Seu plano está ativo. Bom trabalho!" />
    ) : (
      <Banner
        icon={<Clock className="h-5 w-5 text-gold-700" />}
        title="Confirmando seu pagamento…"
        text="Isso costuma levar poucos segundos (Pix) ou alguns minutos (cartão). Esta página se atualiza sozinha."
      />
    );
  }

  return status === "cancelado" ? (
    <Banner icon={<XCircle className="h-5 w-5 text-text-muted" />} title="Pagamento cancelado" text="Nenhuma cobrança foi feita. Você pode escolher um plano novamente quando quiser." />
  ) : (
    <Banner icon={<XCircle className="h-5 w-5 text-text-muted" />} title="O link de pagamento expirou" text="Nenhuma cobrança foi feita. Escolha o plano novamente para gerar um novo link." />
  );
}

function Banner({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <Card role="status">
      <CardContent className="flex items-start gap-3 py-4">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div>
          <p className="font-medium text-text-primary">{title}</p>
          <p className="text-sm text-text-muted">{text}</p>
        </div>
      </CardContent>
    </Card>
  );
}
