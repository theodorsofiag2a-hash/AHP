/**
 * Índice Randômico (RI) de Saaty. Acima de n=8 não há tabela oficial precisa;
 * o sistema legado usa um valor fixo aproximado — preservado aqui por paridade.
 */
export const RI_TABLE: Record<number, number> = {
  1: 0,
  2: 0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
};
export const RI_FALLBACK = 1.45;

export const CONSISTENCY_THRESHOLD = 0.1;

export function randomIndexFor(n: number): number {
  return RI_TABLE[n] ?? RI_FALLBACK;
}

export interface PillarWeightResult {
  weights: number[];
  columnSums: number[];
}

/**
 * Método aproximado clássico de Saaty (soma normalizada de colunas + média das linhas).
 * Não é uma decomposição de autovalor real — preservado por paridade com o sistema legado.
 */
export function computePillarWeights(matrix: number[][]): PillarWeightResult {
  const n = matrix.length;
  const columnSums = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) columnSums[j] += matrix[i][j];
  }

  const weights: number[] = [];
  for (let i = 0; i < n; i++) {
    let rowSum = 0;
    for (let j = 0; j < n; j++) rowSum += matrix[i][j] / columnSums[j];
    weights.push(rowSum / n);
  }

  return { weights, columnSums };
}

export function computeLambdaMax(weights: number[], columnSums: number[]): number {
  let lambdaMax = 0;
  for (let i = 0; i < weights.length; i++) lambdaMax += weights[i] * columnSums[i];
  return lambdaMax;
}

/** Retorna o CR como fração (0-1), não como percentual. */
export function computeConsistencyRatio(lambdaMax: number, n: number): number {
  if (n <= 2) return 0;
  const ri = randomIndexFor(n);
  return (lambdaMax - n) / (n - 1) / ri;
}
