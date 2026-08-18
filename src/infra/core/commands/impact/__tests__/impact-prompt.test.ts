import { buildImpactPrompt, ImpactPromptInput } from '../impact-prompt';

describe('impact-prompt', () => {
  const input: ImpactPromptInput = {
    knowledgeDocs: [
      {
        path: '/docs/cancelamento.md',
        content: '# Regra: cancelamento\nO cancelamento deve ser registrado em auditoria.'
      }
    ],
    files: [
      {
        path: 'src/cancel.ts',
        language: 'typescript',
        content: 'export function cancel() {}',
        truncated: false
      }
    ]
  };

  it('includes files and knowledge docs in the prompt', () => {
    const prompt = buildImpactPrompt(input);

    expect(prompt).toContain('src/cancel.ts');
    expect(prompt).toContain('export function cancel() {}');
    expect(prompt).toContain('cancelamento.md');
    expect(prompt).toContain('O cancelamento deve ser registrado em auditoria.');
    expect(prompt).toContain('Não altere, crie, exclua');
    expect(prompt).toContain('Não dê feedback de qualidade');
  });

  it('marks truncated files and shows placeholder when no knowledge docs provided', () => {
    const prompt = buildImpactPrompt({
      files: [{ ...input.files[0], truncated: true }],
      knowledgeDocs: []
    });

    expect(prompt).toContain('Conteúdo truncado pelo limite de custo.');
    expect(prompt).toContain('Nenhuma documentação encontrada');
  });

  it('keeps the prompt within its estimated token budget', () => {
    const prompt = buildImpactPrompt({
      files: [
        {
          ...input.files[0],
          content: 'x'.repeat(30000),
          truncated: true
        }
      ],
      knowledgeDocs: []
    });

    expect(prompt.length).toBeLessThanOrEqual(3500 * 4);
    expect(prompt).toContain('Contexto adicional removido');
  });

  it('redacts sensitive tokens from file content', () => {
    const prompt = buildImpactPrompt({
      files: [
        {
          path: 'secrets.txt',
          language: 'text',
          content: 'this contains ghp_abcdefghijklmnopqrstuvxyz',
          truncated: false
        }
      ],
      knowledgeDocs: []
    });

    expect(prompt).toContain('[REDACTED]');
  });

  it('shows placeholder when no readable files provided', () => {
    const prompt = buildImpactPrompt({ files: [], knowledgeDocs: [] });
    expect(prompt).toContain('[Nenhum conteúdo legível foi encontrado.]');
  });
});

