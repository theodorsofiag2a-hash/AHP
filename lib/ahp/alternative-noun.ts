/** Como chamar o que é avaliado em cada modelo: projetos (Projeto), fornecedores (Fornecedor) ou alternativas. */
export interface AlternativeNoun {
  singular: string;
  plural: string;
  /** "o" ou "a" */
  article: "o" | "a";
  example: string;
}

export function alternativeNoun(category: string | null): AlternativeNoun {
  if (category === "projeto") return { singular: "projeto", plural: "projetos", article: "o", example: "Projeto A" };
  if (category === "fabricante") return { singular: "fornecedor", plural: "fornecedores", article: "o", example: "Fornecedor A" };
  return { singular: "alternativa", plural: "alternativas", article: "a", example: "Alternativa A" };
}
