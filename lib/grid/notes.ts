/**
 * Notas 1 a 7 da Tabela 4-1 da NT-ONS DPL 0095/2026 (Rev 0). Texto de apoio à leitura da
 * tabela; em caso de divergência, vale o documento do ONS.
 */
export const GRID_NOTES: Record<number, string> = {
  1: "Barramento candidato virtual: impactado por empreendimentos cadastrados na rede de distribuição.",
  2: "Seccionamento de linha: o empreendedor equaciona barramento, entradas de linha e reforços com a transmissora.",
  3: "Capacidade limitada para evitar superação de equipamentos por curto-circuito (item 7.2.1).",
  4: "Sujeita à substituição de disjuntores (item 7.2.2).",
  5: "Sem disponibilidade física para a conexão; a margem só vale para projetos conectados pela distribuição com reflexo em SE de Rede Básica de Fronteira.",
  6: "Margem limitada por problemas nos cenários de carregamento dos SAE.",
  7: "Subestação fora do horizonte de entrega em 2028 (datas do CMSE de 01/07/2026) ou equipamento a ser desativado.",
};

/** Nota 2 = seccionamento de linha (alimenta o subcritério "Interligação ao SIN"). */
export const SECTIONING_NOTE = 2;
