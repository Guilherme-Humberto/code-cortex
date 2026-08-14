/**
 * Funções auxiliares para gerenciamento de orçamento de tokens
 * em contextos de modelos de linguagem (LLM).
 */

const CHARACTERS_PER_TOKEN = 4;

/**
 * Estima a quantidade de tokens de um texto.
 *
 * Esta é uma aproximação baseada no tamanho do texto.
 * O valor real pode variar dependendo do modelo utilizado.
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARACTERS_PER_TOKEN);
}

/**
 * Distribui um orçamento de tokens proporcionalmente entre
 * diferentes conteúdos de texto.
 *
 * Caso o total estimado seja menor que o orçamento disponível,
 * mantém a quantidade original estimada de tokens.
 */
export function distributeBudget(
  totalBudget: number,
  items: readonly string[]
): number[] {
  if (items.length === 0) {
    return [];
  }

  const tokenCounts = items.map(estimateTokenCount);

  const totalTokens = tokenCounts.reduce((total, count) => total + count, 0);

  if (totalTokens <= totalBudget) {
    return tokenCounts;
  }

  return tokenCounts.map(count =>
    Math.floor((count / totalTokens) * totalBudget)
  );
}
