import "server-only";
import { redirect } from "next/navigation";
import { getBillingSummary } from "@/lib/billing/user-plan";
import { isTrialBilling } from "@/lib/billing/trial";
import { isModelLocked } from "./model-access";

/** Páginas de um modelo: na versão gratuita, modelo bloqueado volta para a lista de modelos. */
export async function requireModelAccess(model: { trial_available?: boolean | null }, userId: string): Promise<void> {
  const trial = isTrialBilling(await getBillingSummary(userId));
  if (isModelLocked(model, trial)) redirect("/models");
}
