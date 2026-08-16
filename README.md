# CodeCortex

Contexto controlado para entender código, consultar documentação e analisar impactos com provedores de LLM (ex.: Copilot, OpenAI, Anthropic).

O CodeCortex é uma extensão do VS Code para investigações técnicas e funcionais sem enviar o workspace inteiro ao modelo. Você escolhe os arquivos relevantes, define o contexto da consulta e recebe a resposta diretamente na aba da extensão. A extensão suporta múltiplos providers de LLM configuráveis e alternáveis na tela de Configurações.

## Fluxo atual

- Adicione arquivos pelo menu de contexto do Explorer.
- Execute uma análise de impacto sobre os arquivos em foco.
- Selecione um trecho de código para consultar a documentação funcional.
- Faça perguntas sobre os arquivos em foco e a documentação em `code-cortex/knowledge`.
- Escolha o modelo Copilot na tela de configurações.
- Selecione um trecho de código para consultar a documentação funcional.
- Faça perguntas sobre os arquivos em foco e a documentação em `code-cortex/knowledge`.
- Selecione o provider de LLM e o modelo na tela de configurações. O provider precisa estar registrado no host do VS Code para que a lista de modelos apareça.

## Consultas disponíveis

### Código selecionado

Selecione um trecho no editor e use `CodeCortex: Pesquisar sobre o código`. A consulta relaciona o trecho selecionado com a documentação funcional disponível em `code-cortex/knowledge`.

### Arquivos em foco

Adicione arquivos pelo Explorer e use a aba CodeCortex para:

- Entender o comportamento funcional do módulo.
- Perguntar sobre regras de negócio e fluxos relacionados.
- Avaliar impactos técnicos entre os arquivos selecionados.

## Limites e privacidade

- As consultas são somente leitura.
- O modelo não deve criar, excluir ou modificar arquivos.
- O contexto enviado é limitado aos arquivos selecionados e à documentação fornecida em `code-cortex/knowledge`.
- O workspace inteiro não é consultado automaticamente.
- Arquivos grandes são truncados para manter o consumo de tokens previsível.
- O resultado é exibido em Markdown e pode ser copiado pela própria aba.

Segurança e sincronização

- Sincronização: apenas extensões permitidas são copiadas (markdown, texto, json, yaml, csv, html, docx convertido). Arquivos binários e muito grandes são ignorados.
- Extração DOCX: `.docx` é convertido para texto antes de salvar em `code-cortex/knowledge`.
- Redaction: conteúdos sensíveis (chaves, certificados, tokens) são automaticamente redigidos antes de enviar prompts.
- Histórico híbrido: metadados no `workspaceState` e arquivos `.md` sob `code-cortex/_history`. Há opção de limpar ou exportar.

O modelo utilizado e a estimativa de tokens aparecem junto ao resultado. O modelo pode ser escolhido na tela de configurações da extensão.

## Desenvolvimento

```bash
npm install
npm run compile
```

O build executa verificação de tipos, lint e empacotamento com esbuild.

Para executar os testes unitários:

```bash
npm run test:unit
npm run test:coverage
```

O projeto mantém cobertura mínima de 90% nos módulos incluídos na coleta de cobertura unitária.
