import { buildImpactPrompt, ImpactPromptInput } from '../impact-prompt';

describe('impact-prompt', () => {
  const input: ImpactPromptInput = {
    objective: 'Avaliar o fluxo de cancelamento.',
    files: [
      {
        path: 'src/cancel.ts',
        language: 'typescript',
        content: 'export function cancel() {}',
        truncated: false
      }
    ]
  };

  it('includes the objective and selected file context', () => {
    const prompt = buildImpactPrompt(input);

    expect(prompt).toContain('Avaliar o fluxo de cancelamento.');
    expect(prompt).toContain('src/cancel.ts');
    expect(prompt).toContain('export function cancel() {}');
    expect(prompt).toContain('Não altere, crie, exclua');
    expect(prompt).toContain('Não consulte, infira ou solicite');
  });

  it('marks truncated files and uses the default objective', () => {
    const prompt = buildImpactPrompt({
      files: [{ ...input.files[0], truncated: true }]
    });

    expect(prompt).toContain('Avaliar possíveis impactos');
    expect(prompt).toContain('Conteúdo truncado pelo limite de custo.');
  });

  it('keeps the prompt within its estimated token budget', () => {
    const prompt = buildImpactPrompt({
      files: [
        {
          ...input.files[0],
          content: 'x'.repeat(30000),
          truncated: true
        }
      ]
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
      ]
    });

    expect(prompt).toContain('[REDACTED]');
  });

  it('shows placeholder when no readable files provided', () => {
    const prompt = buildImpactPrompt({ files: [] });
    expect(prompt).toContain('[Nenhum conteúdo legível foi encontrado.]');
  });
});
