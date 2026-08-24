import * as path from 'node:path';

import {
  SELECTED_FILE_CONTEXT_LIMITS,
  SelectedFileContext
} from '../../context/selected-file-context';
import { redactSensitiveContent } from '../../utils/redact-sensitive.util';
import { KnowledgeDocument } from '@/capabilities/knowledge/commands/knowledge-context';

export interface ImpactPromptInput {
  readonly files: readonly SelectedFileContext[];
  readonly knowledgeDocs: readonly KnowledgeDocument[];
  readonly changeContext?: string;
}

export function buildImpactPrompt(input: ImpactPromptInput): string {
  const files = input.files
    .map(file => {
      const redactedContent = redactSensitiveContent(file.content, file.path);
      const truncationNote = file.truncated
        ? '\n[Conteúdo truncado pelo limite de custo.]'
        : '';

      return `### ${file.path} (${file.language})\n\`\`\`${file.language}\n${redactedContent}${truncationNote}\n\`\`\``;
    })
    .join('\n\n');

  const knowledgeContext = input.knowledgeDocs
    .map(
      doc =>
        `### Documento: ${path.basename(doc.path)}\n${redactSensitiveContent(doc.content, doc.path)}`
    )
    .join('\n\n');

  const prompt = `Você é um analisador de impacto em modo somente leitura.

RESTRIÇÕES OBRIGATÓRIAS E INVIOLÁVEIS:
- Não altere, crie, exclua ou sugira alterações em nenhum arquivo.
- Não escreva código, patches, diffs ou instruções de edição.
- Não dê feedback de qualidade, sugestões de melhoria ou recomendações de testes genéricos.
- Analise EXCLUSIVAMENTE a relação entre os arquivos em foco e as regras documentadas na Base de Conhecimento.
- Não use conhecimento externo para preencher lacunas de documentação.
- Não consulte nem infira sobre arquivos fora dos fornecidos.

TAREFA:
Verifique se a alteração pretendida pelo usuário, considerando os arquivos em foco, viola ou impacta alguma regra documentada na Base de Conhecimento Funcional.

Responda com EXATAMENTE UMA das três saídas:
- SAÍDA A — Sem impacto: nenhuma regra documentada é afetada.
- SAÍDA B — Com impacto: uma ou mais regras documentadas são afetadas. Cite o documento de origem e o conflito específico.
- SAÍDA C — Informação insuficiente: a documentação não cobre os comportamentos em análise. Indique exatamente qual gap impede a conclusão.

## Arquivos em foco
${files || '[Nenhum conteúdo legível foi encontrado.]'}

## Alteração pretendida pelo usuário
${input.changeContext || '[Nenhuma alteração pretendida foi informada.]'}

## Base de Conhecimento Funcional
${knowledgeContext || '[Nenhuma documentação encontrada em code-cortex/knowledge.]'}

Responda em português brasileiro, neste formato:

## Resultado
[Sem impacto | Com impacto | Informação insuficiente]

## Justificativa
[Com base nas regras documentadas ou no gap identificado.]

## Regras consultadas
- [nome do documento] -> [regra analisada]`;

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
