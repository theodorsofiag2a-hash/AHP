import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import type { ReportChartsData } from "./build-data";

/** Tamanho em pixels de cada gráfico; a proporção precisa bater com o tamanho da figura no modelo Word (ver docs/RELATORIO.md). */
export const CHART_SIZES = {
  weights: { width: 1600, height: 700 },
  radar: { width: 1200, height: 1100 },
  composition: { width: 1600, height: 900 },
} as const;

// Paleta do próprio modelo (ouro e grafite), uma cor fixa por pilar.
const PILLAR_COLORS = ["#111827", "#d4af37", "#9ca3af", "#fcd34d"];
const SERIES_COLORS = ["#d4af37", "#111827", "#9ca3af"];
const TEXT = "#111827";
const MUTED = "#6b7280";
const GRID = "#e5e7eb";
const FONT = "DejaVu Sans";

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

/** Quebra o texto em linhas de até `max` caracteres, sem partir palavras. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(" ")) {
    if (current && `${current} ${word}`.length > max) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function svgOpen(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>`;
}

function title(text: string, width: number): string {
  return `<text x="${width / 2}" y="52" text-anchor="middle" font-family="${FONT}" font-weight="bold" font-size="34" fill="${TEXT}">${esc(text)}</text>`;
}

function legend(items: { name: string; color: string }[], width: number, y: number): string {
  const approx = (s: string) => 30 + s.length * 17;
  const total = items.reduce((sum, it) => sum + approx(it.name) + 40, 0);
  let x = Math.max(20, (width - total) / 2);
  return items
    .map((it) => {
      const out = `<rect x="${x}" y="${y - 18}" width="26" height="26" fill="${it.color}"/><text x="${x + 36}" y="${y + 2}" font-family="${FONT}" font-size="24" fill="${TEXT}">${esc(it.name)}</text>`;
      x += approx(it.name) + 40;
      return out;
    })
    .join("");
}

export function weightsChartSvg(data: ReportChartsData["weights"]): string {
  const { width, height } = CHART_SIZES.weights;
  const left = 600;
  const right = 160;
  const top = 100;
  const rowH = (height - top - 40) / data.length;
  const max = Math.max(...data.map((d) => d.weight), 0.01);
  const scale = (width - left - right) / max;
  const bars = data
    .map((d, i) => {
      const y = top + i * rowH;
      const w = Math.max(2, d.weight * scale);
      return `<text x="${left - 20}" y="${y + rowH / 2 + 9}" text-anchor="end" font-family="${FONT}" font-size="26" fill="${TEXT}">${esc(truncate(d.name, 40))}</text>
<rect x="${left}" y="${y + rowH * 0.18}" width="${w}" height="${rowH * 0.64}" fill="${PILLAR_COLORS[i % 4]}"/>
<text x="${left + w + 14}" y="${y + rowH / 2 + 9}" font-family="${FONT}" font-weight="bold" font-size="26" fill="${TEXT}">${pct(d.weight)}</text>`;
    })
    .join("\n");
  return `${svgOpen(width, height)}${title("Distribuição de pesos por pilar", width)}${bars}</svg>`;
}

export function radarChartSvg(data: ReportChartsData["radar"]): string {
  const { width, height } = CHART_SIZES.radar;
  const cx = width / 2;
  const cy = 500;
  const radius = 270;
  const n = data.axes.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, value: number) => {
    const r = (Math.max(0, Math.min(10, value)) / 10) * radius;
    return [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  };
  const rings = [2, 4, 6, 8, 10]
    .map((v) => {
      const pts = Array.from({ length: n }, (_, i) => point(i, v).map((c) => c.toFixed(1)).join(",")).join(" ");
      return `<polygon points="${pts}" fill="none" stroke="${GRID}" stroke-width="2"/>`;
    })
    .join("");
  const ringLabels = [2, 4, 6, 8, 10]
    .map((v) => `<text x="${cx + 8}" y="${cy - (v / 10) * radius + 8}" font-family="${FONT}" font-size="20" fill="${MUTED}">${v}</text>`)
    .join("");
  const spokes = Array.from({ length: n }, (_, i) => {
    const [x, y] = point(i, 10);
    return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${GRID}" stroke-width="2"/>`;
  }).join("");
  const labels = data.axes
    .map((name, i) => {
      const [x, y] = point(i, 10.8);
      const horizontal = Math.abs(x - cx) < 30;
      const anchor = horizontal ? "middle" : x > cx ? "start" : "end";
      const lines = wrap(name, 18);
      const lineH = 30;
      // Topo: o texto cresce para cima; base/laterais: para baixo.
      const startY = horizontal && y < cy ? y - 14 - (lines.length - 1) * lineH : y + (horizontal ? 36 : 8 - ((lines.length - 1) * lineH) / 2);
      const tspans = lines
        .map((line, k) => `<tspan x="${x.toFixed(1)}" dy="${k === 0 ? 0 : lineH}">${esc(line)}</tspan>`)
        .join("");
      return `<text x="${x.toFixed(1)}" y="${startY.toFixed(1)}" text-anchor="${anchor}" font-family="${FONT}" font-size="24" fill="${TEXT}">${tspans}</text>`;
    })
    .join("");
  const shapes = data.series
    .map((s, k) => {
      const pts = s.values.map((v, i) => point(i, v).map((c) => c.toFixed(1)).join(",")).join(" ");
      const color = SERIES_COLORS[k % SERIES_COLORS.length];
      return `<polygon points="${pts}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="5"/>`;
    })
    .join("");
  const items = data.series.map((s, k) => ({ name: truncate(s.name, 22), color: SERIES_COLORS[k % SERIES_COLORS.length] }));
  return `${svgOpen(width, height)}${title("Impressão digital (desempenho 0–10) — Top 3", width)}${rings}${spokes}${ringLabels}${shapes}${labels}${legend(items, width, height - 50)}</svg>`;
}

export function compositionChartSvg(data: ReportChartsData["composition"]): string {
  const { width, height } = CHART_SIZES.composition;
  const left = 300;
  const right = 60;
  const top = 100;
  const bottom = 190;
  const rows = data.rows.slice(0, 12);
  const rowH = (height - top - bottom) / Math.max(rows.length, 1);
  const plotW = width - left - right;
  const x = (v: number) => left + (v / 100) * plotW;
  const grid = [0, 20, 40, 60, 80, 100]
    .map(
      (v) =>
        `<line x1="${x(v)}" y1="${top}" x2="${x(v)}" y2="${height - bottom}" stroke="${GRID}" stroke-width="2"/><text x="${x(v)}" y="${height - bottom + 34}" text-anchor="middle" font-family="${FONT}" font-size="22" fill="${MUTED}">${v}</text>`
    )
    .join("");
  const bars = rows
    .map((r, i) => {
      const y = top + i * rowH;
      let acc = 0;
      const segs = r.points
        .map((p, k) => {
          const w = (Math.max(0, p) / 100) * plotW;
          const seg = `<rect x="${(left + (acc / 100) * plotW).toFixed(1)}" y="${y + rowH * 0.18}" width="${w.toFixed(1)}" height="${rowH * 0.64}" fill="${PILLAR_COLORS[k % 4]}"/>`;
          acc += Math.max(0, p);
          return seg;
        })
        .join("");
      return `<text x="${left - 16}" y="${y + rowH / 2 + 9}" text-anchor="end" font-family="${FONT}" font-size="24" fill="${TEXT}">${esc(truncate(r.name, 22))}</text>${segs}<text x="${x(acc) + 12}" y="${y + rowH / 2 + 9}" font-family="${FONT}" font-weight="bold" font-size="22" fill="${TEXT}">${acc.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</text>`;
    })
    .join("");
  const items = data.pillars.map((name, k) => ({ name, color: PILLAR_COLORS[k % 4] }));
  // Legenda em 2 linhas para caber os nomes longos dos pilares.
  const half = Math.ceil(items.length / 2);
  const leg = legend(items.slice(0, half), width, height - 70) + legend(items.slice(half), width, height - 28);
  return `${svgOpen(width, height)}${title("Composição da nota final (base 100)", width)}${grid}${bars}${leg}</svg>`;
}

const FONT_FILES = ["DejaVuSans.ttf", "DejaVuSans-Bold.ttf"].map((f) => path.join(process.cwd(), "lib/report/fonts", f));

export function svgToPng(svg: string): Buffer {
  // Fontes versionadas no repositório: o servidor (Vercel) não tem fontes de sistema garantidas.
  const resvg = new Resvg(svg, {
    font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: FONT },
  });
  return Buffer.from(resvg.render().asPng());
}

export function renderCharts(data: ReportChartsData): { weights: Buffer; radar: Buffer; composition: Buffer } {
  return {
    weights: svgToPng(weightsChartSvg(data.weights)),
    radar: svgToPng(radarChartSvg(data.radar)),
    composition: svgToPng(compositionChartSvg(data.composition)),
  };
}
