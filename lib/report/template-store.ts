import "server-only";
import { readFileSync } from "node:fs";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * O modelo Word é proprietário da G2A e o repositório é público: ele fica num bucket PRIVADO do Supabase
 * Storage (sem política de acesso, só a service role lê). Arquivos esperados no bucket `report-templates`:
 *   bess-project.docx           modelo com marcadores (ver docs/RELATORIO.md)
 *   bess-project.criteria.json  (opcional) textos de "Definição" e "Leitura" por critério
 */
const BUCKET = "report-templates";
const TEMPLATE_FILE = "bess-project.docx";
const CRITERIA_FILE = "bess-project.criteria.json";

export interface LoadedTemplate {
  docx: Buffer;
  criteriaTexts: Record<string, { definition?: string; reading?: string }>;
}

export async function loadReportTemplate(): Promise<LoadedTemplate | null> {
  // Desenvolvimento local: aponta para um arquivo em disco (nunca em produção).
  const localPath = process.env.REPORT_TEMPLATE_PATH;
  if (localPath && process.env.NODE_ENV !== "production") {
    return { docx: readFileSync(localPath), criteriaTexts: {} };
  }

  const storage = createAdminClient().storage.from(BUCKET);
  const { data: file, error } = await storage.download(TEMPLATE_FILE);
  if (error || !file) return null;

  let criteriaTexts: LoadedTemplate["criteriaTexts"] = {};
  const { data: criteria } = await storage.download(CRITERIA_FILE);
  if (criteria) {
    try {
      const parsed = JSON.parse(await criteria.text());
      if (parsed && typeof parsed === "object") criteriaTexts = parsed;
    } catch {
      // JSON inválido: segue sem os textos opcionais.
    }
  }

  return { docx: Buffer.from(await file.arrayBuffer()), criteriaTexts };
}
