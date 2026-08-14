import {
  createFilesKnowledgePrompt,
  createKnowledgePrompt
} from '../knowledge-prompt';

describe('knowledge-prompt', () => {
  const documents = [
    {
      path: '/workspace/code-cortex/knowledge/orders/cancel.md',
      content: 'Pedidos podem ser cancelados antes do faturamento.'
    }
  ];

  it('builds a prompt for selected code and documentation', () => {
    const prompt = createKnowledgePrompt(
      'function cancelOrder() {}',
      documents
    );

    expect(prompt).toContain('function cancelOrder() {}');
    expect(prompt).toContain('cancel.md');
    expect(prompt).toContain('Pedidos podem ser cancelados');
    expect(prompt).toContain('Não altere, crie, exclua');
    expect(prompt).toContain('Não consulte nem peça');
  });

  it('builds a prompt for focused files and a question', () => {
    const prompt = createFilesKnowledgePrompt(
      [
        {
          path: 'src/orders.ts',
          language: 'typescript',
          content: 'export function cancelOrder() {}',
          truncated: false
        }
      ],
      documents,
      'Quais regras se aplicam ao cancelamento?'
    );

    expect(prompt).toContain('Quais regras se aplicam ao cancelamento?');
    expect(prompt).toContain('src/orders.ts');
    expect(prompt).toContain('cancel.md');
    expect(prompt).toContain('## Resposta');
    expect(prompt).toContain('Pontos sem confirmação');
  });

  it('limits focused documentation to eight documents and 1800 characters each', () => {
    const manyDocuments = Array.from({ length: 10 }, (_, index) => ({
      path: `/workspace/doc-${index}.md`,
      content: 'x'.repeat(2000)
    }));

    const prompt = createFilesKnowledgePrompt(
      [],
      manyDocuments,
      'Qual é o contexto?'
    );

    expect(prompt).toContain('doc-0.md');
    expect(prompt).toContain('doc-7.md');
    expect(prompt).not.toContain('doc-8.md');
    expect(prompt).not.toContain('doc-9.md');
  });
});
