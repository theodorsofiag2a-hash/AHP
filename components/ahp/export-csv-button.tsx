"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExportCsvButtonProps {
  modelName: string;
  consistencyRatio: number;
  pillarWeights: { name: string; weight: number }[];
  ranking: { rank: number; name: string; finalScore: number }[];
}

function csvEscape(value: string | number) {
  const str = String(value);
  return /[",\n;]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function ExportCsvButton({ modelName, consistencyRatio, pillarWeights, ranking }: ExportCsvButtonProps) {
  function handleExport() {
    const lines: string[] = [];
    lines.push(`Relatorio AHP;${csvEscape(modelName)}`);
    lines.push(`Data;${new Date().toLocaleString("pt-BR")}`);
    lines.push(`CR (Razao de Consistencia);${(consistencyRatio * 100).toFixed(2)}%`);
    lines.push("");
    lines.push("Pesos por pilar");
    lines.push("Pilar;Peso (%)");
    pillarWeights.forEach((p) => lines.push(`${csvEscape(p.name)};${(p.weight * 100).toFixed(2)}`));
    lines.push("");
    lines.push("Ranking final");
    lines.push("Posicao;Alternativa;Nota final");
    ranking.forEach((r) => lines.push(`${r.rank};${csvEscape(r.name)};${r.finalScore.toFixed(0)}`));

    const csvContent = "﻿" + lines.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `ahp-${modelName.toLowerCase().replace(/\s+/g, "-")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleExport}>
      <Download className="h-4 w-4" />
      Exportar CSV
    </Button>
  );
}
