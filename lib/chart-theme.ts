/**
 * Cores dos gráficos (Recharts não lê classes Tailwind). Espelham os tokens de app/globals.css.
 */
export const CHART_THEME = {
  grid: "#e4dcc8", // --border-subtle
  axis: "#5f5a50", // --text-muted
  axisFaint: "#6f6a60", // --text-faint
  surface: "#ffffff", // --bg-surface
  text: "#1b1c1f", // --text-primary
  cursor: "#f6f1e4", // --bg-surface-alt
} as const;

export const CHART_TOOLTIP_STYLE = {
  background: CHART_THEME.surface,
  border: `1px solid ${CHART_THEME.grid}`,
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "0 12px 32px rgba(27, 28, 31, 0.1)",
} as const;
