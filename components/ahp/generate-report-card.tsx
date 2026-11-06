"use client";

import { useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

function fileNameFrom(header: string | null, fallback: string): string {
  const match = header?.match(/filename="([^"]+)"/);
  return match?.[1] ?? fallback;
}

export function GenerateReportCard({
  modelId,
  runId,
  defaultClientName,
  defaultDocumentNumber,
}: {
  modelId: string;
  runId: string;
  defaultClientName: string;
  defaultDocumentNumber: string;
}) {
  const [clientName, setClientName] = useState(defaultClientName);
  const [responsible, setResponsible] = useState("");
  const [documentNumber, setDocumentNumber] = useState(defaultDocumentNumber);
  const [loading, setLoading] = useState(false);

  async function generate(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(`/models/${modelId}/run/${runId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientName, responsible, documentNumber }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error ?? "Não foi possível gerar o relatório.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileNameFrom(response.headers.get("Content-Disposition"), "relatorio-priorizacao.docx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Relatório gerado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o relatório.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-gold-600" /> Relatório de priorização
        </CardTitle>
        <CardDescription>
          Gera o Premissário e Relatório (Word) com o ranking, os pesos, os gráficos e a análise de sensibilidade desta execução.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={generate} className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-client">Cliente</Label>
            <Input id="report-client" value={clientName} onChange={(e) => setClientName(e.target.value)} maxLength={120} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-responsible">Responsável técnico</Label>
            <Input
              id="report-responsible"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder="Nome de quem assina"
              maxLength={120}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="report-number">Nº do documento</Label>
            <Input id="report-number" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} maxLength={40} required />
          </div>
          <div className="md:col-span-3">
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Gerar relatório
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
