import { parseHistoryFile } from '../history-entry-parser';

describe('history-entry-parser', () => {
  it('parses frontmatter fields, including a list of files', () => {
    const content = [
      '---',
      'id: 20260814_impact_analysis_01',
      'kind: impact-analysis',
      'title: Análise de impacto',
      'summary: Resumo curto',
      'model: GPT-4o',
      'estimatedTokens: 123',
      'createdAt: 2026-08-14T12:34:56.789Z',
      'files:',
      '  - src/a.ts',
      '  - src/b.ts',
      '---',
      '',
      '# Resultado'
    ].join('\n');

    expect(
      parseHistoryFile(
        '20260814_impact_analysis_01.md',
        content,
        'code-cortex/.history'
      )
    ).toEqual({
      id: '20260814_impact_analysis_01',
      kind: 'impact-analysis',
      title: 'Análise de impacto',
      summary: 'Resumo curto',
      modelName: 'GPT-4o',
      totalTokens: 123,
      createdAt: '2026-08-14T12:34:56.789Z',
      files: ['src/a.ts', 'src/b.ts'],
      path: 'code-cortex/.history/20260814_impact_analysis_01.md'
    });
  });

  it('falls back to "manual" kind and derives id/createdAt from the file name when frontmatter is missing them', () => {
    const content = '---\ntitle: Sem id\n---\n\nConteúdo';

    const entry = parseHistoryFile(
      '20260901_manual_02.md',
      content,
      'code-cortex/.history'
    );

    expect(entry?.kind).toBe('manual');
    expect(entry?.id).toBe('20260901_manual_02');
    expect(entry?.createdAt).toBe(new Date(2026, 8, 1).toISOString());
    expect(entry?.files).toEqual([]);
  });

  it('uses the raw file name as title when the frontmatter has no title', () => {
    const entry = parseHistoryFile(
      'sem-frontmatter.md',
      'apenas texto',
      'code-cortex/.history'
    );

    expect(entry?.title).toBe('sem-frontmatter.md');
    expect(entry?.modelName).toBe('Modelo não identificado');
    expect(entry?.totalTokens).toBe(0);
  });
});
