import { after, NextResponse } from "next/server";
import { getAsaasClient, getAsaasEnv } from "@/lib/asaas/client";
import { isValidWebhookToken } from "@/lib/asaas/webhook-auth";
import { parseEnvelope, processEvent, storeEvent } from "@/lib/billing/asaas-events";
import { createAdminClient } from "@/lib/supabase/admin";

// Margem para o processamento em after() (consulta ao Asaas + gravações).
export const maxDuration = 30;

const MAX_BODY_BYTES = 256 * 1024;

/**
 * Webhook do Asaas. Contrato: responder 200 rápido; 15 falhas seguidas pausam a fila do Asaas.
 * Fluxo: confere o token -> grava o evento (idempotente por id) -> responde 200 -> processa em after().
 * Quem falha no processamento fica como FAILED na caixa de entrada e é reprocessado na reentrega.
 */
export async function POST(request: Request) {
  if (!isValidWebhookToken(request.headers.get("asaas-access-token"), process.env.ASAAS_WEBHOOK_TOKEN)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const envelope = parseEnvelope(json);
  if (!envelope) {
    return NextResponse.json({ error: "invalid_event" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const stored = await storeEvent(admin, envelope, getAsaasEnv());

    if (stored.status !== "DONE") {
      after(async () => {
        await processEvent(admin, getAsaasClient(), stored.rowId);
      });
    }
  } catch (err) {
    // 500 faz o Asaas reenviar o evento (nada foi perdido: ainda não gravamos).
    console.error("[asaas] webhook: falha ao gravar o evento", envelope.id, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
