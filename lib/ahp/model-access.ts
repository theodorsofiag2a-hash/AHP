/** Na versão gratuita, só os modelos marcados (`ahp_models.trial_available`) ficam liberados. */
export function isModelLocked(model: { trial_available?: boolean | null }, trial: boolean): boolean {
  return trial && model.trial_available !== true;
}

export const MODEL_LOCKED_MESSAGE = "Este modelo está disponível na versão completa. Fale com a G2A.";
