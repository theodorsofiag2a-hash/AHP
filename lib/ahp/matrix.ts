/**
 * Converte o valor do slider de comparação (-8..8) para a escala de Saaty (1/9..9).
 * Port fiel de `processarAHP()` do Apps Script legado.
 */
export function sliderToSaaty(sliderValue: number): number {
  const v = Math.trunc(sliderValue);
  if (v === 0) return 1;
  if (v < 0) return Math.abs(v) + 1;
  return 1 / (v + 1);
}

/**
 * Gera os pares (i, j) com i < j na mesma ordem em que a UI legada monta os sliders
 * (loop duplamente aninhado sobre os pilares). O array de valores de comparação
 * enviado ao motor de cálculo deve seguir exatamente esta ordem.
 */
export function pillarPairIndexes(pillarCount: number): Array<[number, number]> {
  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < pillarCount; i++) {
    for (let j = i + 1; j < pillarCount; j++) {
      pairs.push([i, j]);
    }
  }
  return pairs;
}

/**
 * Monta a matriz recíproca n×n a partir dos valores de Saaty das comparações pareadas
 * (mesma ordem de `pillarPairIndexes`). Port fiel de `calcularAHPGenerico` do Apps Script legado.
 */
export function buildReciprocalMatrix(pillarCount: number, saatyValues: number[]): number[][] {
  const matrix: number[][] = Array.from({ length: pillarCount }, () => new Array(pillarCount).fill(1));
  let k = 0;
  for (let i = 0; i < pillarCount; i++) {
    for (let j = i + 1; j < pillarCount; j++) {
      const val = saatyValues[k];
      matrix[i][j] = val;
      matrix[j][i] = 1 / val;
      k++;
    }
  }
  return matrix;
}
