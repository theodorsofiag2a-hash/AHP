/**
 * Paleta categórica (CVD) com contraste ≥ 3:1 contra o fundo branco dos cards (#ffffff).
 * Ordem fixa — nunca cicle nem reordene por rank; a identidade é sempre a mesma posição
 * (ex: pilar[0] é sempre a cor 1). Ver skill dataviz / references/palette.md.
 */
export const CHART_CATEGORICAL_COLORS = [
  "#3987e5", // 1 blue
  "#d95926", // 2 orange
  "#199e70", // 3 aqua
  "#c98500", // 4 yellow
  "#d55181", // 5 magenta
  "#008300", // 6 green
  "#9085e9", // 7 violet
  "#e66767", // 8 red
] as const;

export function categoricalColor(index: number): string {
  return CHART_CATEGORICAL_COLORS[index % CHART_CATEGORICAL_COLORS.length];
}
