export interface AhpSubcriterionInput {
  id: string;
  weightPct: number;
}

export interface AhpPillarInput {
  id: string;
  subcriteria: AhpSubcriterionInput[];
}

export interface AhpAlternativeInput {
  id: string;
  /** subcriterionId -> nota de desempenho (0-100), vinda da escala escolhida na ficha de avaliação */
  scores: Record<string, number>;
}

export interface AhpRunResult {
  alternativeId: string;
  finalScore: number;
  rank: number;
  /** pontos por pilar (base ~1000), mesma ordem de `pillars` de entrada */
  pillarScores: number[];
  /** desempenho 0-10 por pilar, mesma ordem de `pillars` de entrada */
  pillarScoresRadar: number[];
}

export interface AhpCalculationOutput {
  /** fração 0-1 (ex: 0.0823 = 8.23%) */
  consistencyRatio: number;
  lambdaMax: number;
  /** mesma ordem de `pillars` de entrada */
  pillarWeights: number[];
  ranking: AhpRunResult[];
}
