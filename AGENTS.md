# CodeCortex — Arquitetura atual

CodeCortex é uma extensão do VS Code centrada em uma única aba webview (`code-cortex-view`). Ela mantém uma seleção de arquivos em foco, executa análises de impacto com provedores de LLM configuráveis (Copilot, OpenAI, Anthropic, etc.) e consulta documentação funcional em `code-cortex/knowledge`.

## Fluxo principal

1. `src/extensions.ts` registra a view e os comandos.
2. `src/infra/core/ui/impact-view-provider.ts` renderiza a aba, estados de loading, configurações e resultados Markdown.
3. `src/infra/core/commands/impact/impact.command.ts` gerencia seleção, remoção e análise de impacto.
4. `src/infra/core/commands/impact/impact-analysis.service.ts` chama `vscode.lm` e retorna o resultado da análise.
5. `src/infra/core/context/selected-file-context.ts` limita e lê o contexto dos arquivos selecionados.
6. `src/infra/core/commands/impact/impact-prompt.ts` monta o prompt somente leitura da análise.
7. `src/capabilities/knowledge/commands/search-knowledge.command.ts` consulta documentação por trecho selecionado ou por arquivos em foco.
8. `src/capabilities/knowledge/commands/search-knowledge.command.ts` consulta documentação por trecho selecionado ou por arquivos em foco.
9. `src/infra/core/llm` ( planejado ) contém adaptadores para provedores externos (OpenAI, Anthropic) quando implementados.
10. `src/infra/core/bootstrap/workspace-initializer.ts` registra o provider da view.

## Restrições das consultas

As consultas não alteram arquivos. O modelo recebe apenas o trecho selecionado ou os arquivos em foco e a documentação fornecida em `code-cortex/knowledge`. O prompt proíbe consultar o workspace inteiro, inventar regras e gerar patches.

Notas de segurança e sincronização:

- A sincronização aplica whitelist de extensões e limites de tamanho; binários são detectados heurísticamente. `.docx` é convertido para texto antes de ser salvo.
- O conteúdo enviado ao provedor passa por redaction automática para reduzir risco de vazamento de segredos.

## Comandos ativos

- `codeCortex.addToImpact`
- `codeCortex.removeFromImpact`
- `codeCortex.startImpactAnalysis`
- `codeCortex.selectImpactFiles`
- `codeCortex_knowledge_search`
- `codeCortex_knowledge_searchFiles`

## Build

```bash
npm run compile
```

O comando executa typecheck, lint e bundle com esbuild.
