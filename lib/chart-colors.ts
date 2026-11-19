/**
 * Paleta categórica dos gráficos, tirada da identidade G2A (ouro da marca + tons terrosos).
 * Validada com o validate_palette.js da skill dataviz (fundo #ffffff): faixa de luminosidade, croma,
 * separação para daltonismo entre vizinhas (ΔE ≥ 16), visão normal (ΔE ≥ 21) e contraste ≥ 3:1 — tudo PASS.
 * Ordem fixa — nunca cicle nem reordene por rank: pilar[0] é sempre a cor 1.
 * As cores de status (--success, --danger) ficam de fora de propósito.
 */
export const CHART_CATEGORICAL_COLORS = [
  "#b07d1f", // 1 ouro (marca)
  "#2b6fb0", // 2 azul
  "#c4552d", // 3 terracota
  "#7a5aa8", // 4 violeta
  "#3f8f5a", // 5 verde
] as const;

export function categoricalColor(index: number): string {
  return CHART_CATEGORICAL_COLORS[index % CHART_CATEGORICAL_COLORS.length];
}
