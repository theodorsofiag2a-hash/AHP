/**
 * Observação de conexão (barramento da NT-ONS) de cada projeto no relatório.
 * Nesta versão do sistema a Conexão ainda não existe, então não há o que informar. Quando a Conexão chegar
 * (migration grid_buses), este arquivo passa a consultar o barramento e a viabilidade de cada projeto.
 */
export interface ReportConnection {
  note: string;
  /** Motivo que torna a conexão inviável (vira risco do projeto), se houver. */
  inviable: string | null;
}

export async function loadConnections(supabase: unknown, alternativeIds: string[]): Promise<Map<string, ReportConnection>> {
  void supabase;
  void alternativeIds;
  return new Map();
}
