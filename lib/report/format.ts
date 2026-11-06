const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function formatNumber(value: number, digits = 1): string {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatPercent(fraction: number, digits = 1): string {
  return `${formatNumber(fraction * 100, digits)}%`;
}

/** "novembro de 2026" */
export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} de ${date.getFullYear()}`;
}

export function formatDateBr(date: Date): string {
  return date.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** Lista com "e" antes do último item: "A, B e C". */
export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function normalizeKey(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
