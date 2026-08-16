import {
  SELECTED_FILE_CONTEXT_LIMITS,
  SelectedFileContext
} from '../../context/selected-file-context';
import { redactSensitiveContent } from '../../utils/redact-sensitive.util';

export interface ImpactPromptInput {
  readonly objective?: string;
  readonly files: readonly SelectedFileContext[];
}

export function buildImpactPrompt(input: ImpactPromptInput): string {
  const objective =
    input.objective?.trim() ||
    'Avaliar possíveis impactos entre os arquivos selecionados.';
  const files = input.files
    .map(file => {
      const redactedContent = redactSensitiveContent(file.content, file.path);
      const truncationNote = file.truncated
        ? '\n[Conteúdo truncado pelo limite de custo.]'
        : '';

      return `### ${file.path} (${file.language})\n\`\`\`${file.language}\n${redactedContent}${truncationNote}\n\`\`\``;
    })
    .join('\n\n');

  const prompt = `Você é um consultor de software fazendo uma análise de impacto econômica e somente de leitura.

RESTRIÇÕES OBRIGATÓRIAS E INVIOLÁVEIS:
- Não altere, crie, exclua ou sugira aplicar alterações em nenhum arquivo.
- Não escreva código e não produza patches, diffs ou comandos de edição.
- Responda exclusivamente como consulta baseada no contexto fornecido.
- Consulte somente os arquivos listados em "Arquivos selecionados" abaixo.
- Não consulte, infira ou solicite informações de outros arquivos do workspace.
- Não use arquivos fora do diretório permitido nem conhecimento externo para preencher lacunas.
- Se o contexto não for suficiente, declare que não é possível concluir com segurança.

Objetivo: ${objective}

Use somente o contexto fornecido. Não invente dependências ou comportamento.
Se uma conclusão não puder ser confirmada, marque-a como hipótese.
Seja conciso: priorize relações entre arquivos, riscos e testes.

Arquivos selecionados:
${files || '[Nenhum conteúdo legível foi encontrado.]'}

Responda em português brasileiro, neste formato:
## Resumo
Uma síntese em até 3 frases.

## Impactos confirmados
- arquivo/símbolo -> consequência

## Hipóteses e pontos para validar
- hipótese -> como validar

## Riscos
- risco (severidade: baixa, média ou alta) -> mitigação

## Testes recomendados
- teste ou verificação objetiva

Não proponha alterações de código completas. Esta etapa serve apenas para orientar a investigação.`;

  return trimPromptToBudget(
    prompt,
    SELECTED_FILE_CONTEXT_LIMITS.maxPromptTokens
  );
}

function trimPromptToBudget(prompt: string, maxTokens: number): string {
  const maxCharacters = maxTokens * 4;
  if (prompt.length <= maxCharacters) {
    return prompt;
  }

  return `${prompt.slice(0, maxCharacters - 180)}\n\n[Contexto adicional removido para respeitar o orçamento.]`;
}
