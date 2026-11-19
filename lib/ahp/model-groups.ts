/** Categorias da tela de modelos (`ahp_models.category`): cada uma vira um cartão só. */
export const MODEL_CATEGORIES = [
  { key: "fabricante", title: "Fornecedor" },
  { key: "projeto", title: "Projeto" },
] as const;

export interface ModelRow {
  id: string;
  name: string;
  updated_at: string;
  category: string | null;
  variant_label: string | null;
  /** Liberado na versão gratuita. */
  trial_available?: boolean | null;
}

export interface ModelGroup {
  /** Chave estável do cartão: a categoria, ou `model:<id>` para modelo sem categoria. */
  key: string;
  title: string;
  /** Visões dentro do cartão (uma só = o cartão abre direto o modelo). */
  models: ModelRow[];
  updatedAt: string;
  /** Categoria, quando o cartão agrupa modelos; nulo para modelo avulso. */
  category: string | null;
}

/**
 * Cartões da tela de modelos: um por categoria (Fornecedor, Projeto) e um por modelo sem categoria.
 * Categorias primeiro, na ordem fixa; os avulsos depois, do mais recente ao mais antigo.
 */
export function groupModels(models: ModelRow[]): ModelGroup[] {
  const groups: ModelGroup[] = [];

  for (const category of MODEL_CATEGORIES) {
    const members = models
      .filter((m) => m.category === category.key)
      .sort((a, b) => (a.variant_label ?? a.name).localeCompare(b.variant_label ?? b.name, "pt-BR"));
    if (members.length === 0) continue;
    groups.push({
      key: category.key,
      title: category.title,
      models: members,
      updatedAt: members.reduce((max, m) => (m.updated_at > max ? m.updated_at : max), members[0].updated_at),
      category: category.key,
    });
  }

  const known = new Set<string>(MODEL_CATEGORIES.map((c) => c.key));
  const loose = models
    .filter((m) => !m.category || !known.has(m.category))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const model of loose) {
    groups.push({ key: `model:${model.id}`, title: model.name, models: [model], updatedAt: model.updated_at, category: null });
  }

  return groups;
}

/** Destino do cartão: o modelo direto (uma visão só) ou a lista de visões da categoria. */
export function groupHref(group: ModelGroup): string {
  if (group.models.length === 1) return `/models/${group.models[0].id}/alternatives`;
  return `/models?categoria=${group.category}`;
}
