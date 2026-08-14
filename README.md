# CodeCortex

Contexto controlado para entender código, consultar documentação e analisar impactos com o Copilot.

O CodeCortex é uma extensão do VS Code para investigações técnicas e funcionais sem enviar o workspace inteiro ao modelo. Você escolhe os arquivos relevantes, define o contexto da consulta e recebe a resposta diretamente na aba da extensão.

## Fluxo atual

- Adicione arquivos pelo menu de contexto do Explorer.
- Execute uma análise de impacto sobre os arquivos em foco.
- Selecione um trecho de código para consultar a documentação funcional.
- Faça perguntas sobre os arquivos em foco e a documentação em `code-cortex/knowledge`.
- Escolha o modelo Copilot na tela de configurações.

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
