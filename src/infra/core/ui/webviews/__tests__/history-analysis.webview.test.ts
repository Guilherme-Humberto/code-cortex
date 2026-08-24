import { buildHistoryWebviewHtml } from '../history.webview';
import { buildImpactAnalysisWebviewHtml } from '../impact-analysis.webview';
import { HistoryEntry } from '../../../history/history.service';

const fakeWebview = { cspSource: 'vscode-resource:' } as any;

function makeEntry(overrides: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: '20260823_impact_analysis_04',
    kind: 'impact-analysis',
    title: 'Análise de impacto (1 arquivo(s))',
    summary: 'Permitir o cancelamento de agendamentos',
    modelName: 'Claude',
    totalTokens: 100,
    createdAt: new Date().toISOString(),
    files: ['src/foo.ts'],
    path: 'code-cortex/_history/20260823_impact_analysis_04.md',
    ...overrides
  };
}

describe('history.webview', () => {
  it('extrai o índice incremental do sufixo numérico do nome do arquivo', () => {
    const html = buildHistoryWebviewHtml(fakeWebview, [makeEntry()]);

    expect(html).toContain('baseName.match(/_(\\d+)$/)');
    expect(html).toContain("replace(/\\.md$/i, '')");
  });

  it('inclui o input de pesquisa que filtra pelo campo summary', () => {
    const html = buildHistoryWebviewHtml(fakeWebview, [makeEntry()]);

    expect(html).toContain('id="search"');
    expect(html).toContain('normalizeText(entry.summary).includes(term)');
  });
});

describe('impact-analysis.webview', () => {
  it('renderiza o botão de reanálise que envia o comando reanalyze', () => {
    const html = buildImpactAnalysisWebviewHtml(
      fakeWebview,
      '## Resultado\nCom impacto',
      100,
      'Claude',
      ['src/foo.ts'],
      'impact-analysis'
    );

    expect(html).toContain('id="reload"');
    expect(html).toContain("command: 'reanalyze'");
  });

  it('oculta o botão de reanálise em pesquisas de conhecimento', () => {
    const html = buildImpactAnalysisWebviewHtml(
      fakeWebview,
      '## Resultado',
      100,
      'Claude',
      [],
      'knowledge-search'
    );

    expect(html).toContain("if (kind === 'knowledge-search')");
  });
});
