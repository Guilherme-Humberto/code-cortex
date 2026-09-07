import * as path from 'node:path';

import { SelectedFileContext } from '@/infra/core/context/selected-file-context';
import { redactSensitiveContent } from '@/infra/core/utils/redact-sensitive.util';
import { KnowledgeDocument } from './knowledge-context';

export function createKnowledgePrompt(
  selectedCode: string,
  documents: readonly KnowledgeDocument[]
): string {
  const knowledgeContext = documents
    .map(
      document =>
        `## Documento: ${path.basename(document.path)}\n\n${redactSensitiveContent(document.content, document.path)}`
    )
    .join('\n\n');

  return `Você está no modo Knowledge, em consulta somente leitura.

RESTRIÇÕES OBRIGATÓRIAS E INVIOLÁVEIS:
- Não altere, crie, exclua ou sugira aplicar alterações em nenhum arquivo.
- Não escreva código, patches, diffs ou instruções de edição.
- Consulte apenas o trecho de código fornecido e os documentos abaixo.
- A única documentação autorizada está dentro de code-cortex/documentation/knowledge.
- Não consulte nem peça para consultar outros arquivos do workspace ou o projeto inteiro.
- Não use conhecimento externo para inventar regras de negócio.
- Se os dados não bastarem, informe explicitamente a limitação.

## Código selecionado
\`\`\`typescript
${selectedCode}
\`\`\`

## Base de Conhecimento Funcional
${knowledgeContext}

Analise a relação funcional entre o código e a documentação. Liste regras de negócio e fluxos relacionados. Caso não exista relação, explique o motivo.
Responda em português brasileiro.`;
}

export function createFilesKnowledgePrompt(
  files: readonly SelectedFileContext[],
  documents: readonly KnowledgeDocument[],
  question: string
): string {
  const fileContext = files
    .map(
      file =>
        `### ${file.path}\n\`\`\`${file.language}\n${redactSensitiveContent(file.content, file.path)}\n\`\`\``
    )
    .join('\n\n');
  const knowledgeContext = documents
    .slice(0, 8)
    .map(
      document =>
        `### Documento: ${path.basename(document.path)}\n${redactSensitiveContent(document.content, document.path).slice(0, 1800)}`
    )
    .join('\n\n');

  return `Você está analisando arquivos em foco para localizar relações com a Base de Conhecimento Funcional, em consulta somente leitura.

RESTRIÇÕES OBRIGATÓRIAS E INVIOLÁVEIS:
- Não altere, crie, exclua ou sugira aplicar alterações em nenhum arquivo.
- Não escreva código, patches, diffs ou instruções de edição.
- Consulte somente os arquivos em foco e os documentos fornecidos abaixo.
- A única documentação autorizada está dentro de code-cortex/documentation/knowledge.
- Não consulte nem peça para consultar outros arquivos do workspace ou o projeto inteiro.
- Não use conhecimento externo para preencher lacunas.
- Se o contexto não bastar, declare a limitação em vez de adivinhar.

## Pergunta
${question}

## Arquivos em foco
${fileContext}

## Base de Conhecimento Funcional
${knowledgeContext}

Responda em português brasileiro, priorizando a pergunta.
## Resposta

## Relações e regras confirmadas
- arquivo ou símbolo -> documentação e comportamento relacionado

## Pontos sem confirmação
- hipótese ou relação que precisa ser validada`;
}
