import * as vscode from 'vscode';

import {
  clearHistoryEntries,
  listHistoryEntries,
  saveHistoryEntry
} from '../history.service';

describe('history.service', () => {
  const workspace = { uri: new vscode.Uri('/workspace') };
  const context = {
    workspaceState: {
      get: jest.fn(() => []),
      update: jest.fn().mockResolvedValue(undefined)
    }
  } as any;

  beforeEach(() => {
    vscode.workspace.workspaceFolders = [workspace];
    context.workspaceState.get.mockReturnValue([]);
    context.workspaceState.update.mockResolvedValue(undefined);
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-08-14T12:34:56.789Z').getTime());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    vscode.workspace.workspaceFolders = [];
  });

  it('saves a Markdown entry with metadata in code-cortex/_history', async () => {
    const createDirectory = jest.spyOn(vscode.workspace.fs, 'createDirectory');
    const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');

    await expect(
      saveHistoryEntry(context, '# Resultado', {
        kind: 'impact-analysis',
        title: 'Análise de impacto',
        modelName: 'Auto',
        totalTokens: 123,
        files: ['src/example.ts']
      })
    ).resolves.toBe('code-cortex/_history/20260814_impact_analysis_01.md');

    expect(createDirectory).toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: expect.stringContaining('_history') }),
      expect.anything()
    );
    const [, bytes] = writeFile.mock.calls[0] as [vscode.Uri, Uint8Array];
    const content = Buffer.from(bytes).toString('utf8');
    expect(content).toContain('id: 20260814_impact_analysis_01');
    expect(content).toContain('kind: impact-analysis');
    expect(content).toContain('title: Análise de impacto');
    expect(content).toContain('files:\n  - src/example.ts');
  });

  it('uses a date, kind and two-digit sequence in the history file name', async () => {
    const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');

    const historyPath = await saveHistoryEntry(context, '# Resultado', {
      kind: 'knowledge-search',
      title: 'Pesquisa na Base de Conhecimento',
      modelName: 'Auto',
      totalTokens: 123,
      files: ['src/first.ts', 'src/last.ts']
    });

    expect(historyPath).toBe(
      'code-cortex/_history/20260814_knowledge_search_01.md'
    );
    expect(writeFile).toHaveBeenCalled();
  });

  it('returns history entries sorted newest first and formatted for display', async () => {
    jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
      ['consulta-20260814123456789.md', vscode.FileType.File],
      ['consulta-20260813120000000.md', vscode.FileType.File],
      ['notes.txt', vscode.FileType.File]
    ] as any);

    context.workspaceState.get.mockReturnValue([
      {
        id: 'abc123',
        kind: 'impact-analysis',
        title: 'Análise de impacto',
        modelName: 'Auto',
        totalTokens: 42,
        createdAt: '2026-08-14T12:34:56.789Z',
        files: ['src/example.ts'],
        path: 'code-cortex/_history/consulta-20260814123456789.md'
      },
      {
        id: 'def456',
        kind: 'knowledge-search',
        title: 'Pesquisa na Base de Conhecimento',
        modelName: 'Auto',
        totalTokens: 5,
        createdAt: '2026-08-13T12:00:00.000Z',
        files: [],
        path: 'code-cortex/_history/consulta-20260813120000000.md'
      }
    ]);

    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);

    await expect(listHistoryEntries(context)).resolves.toEqual([
      {
        id: 'abc123',
        kind: 'impact-analysis',
        title: 'Análise de impacto',
        modelName: 'Auto',
        totalTokens: 42,
        createdAt: '2026-08-14T12:34:56.789Z',
        files: ['src/example.ts'],
        path: 'code-cortex/_history/consulta-20260814123456789.md'
      },
      {
        id: 'def456',
        kind: 'knowledge-search',
        title: 'Pesquisa na Base de Conhecimento',
        modelName: 'Auto',
        totalTokens: 5,
        createdAt: '2026-08-13T12:00:00.000Z',
        files: [],
        path: 'code-cortex/_history/consulta-20260813120000000.md'
      }
    ]);
  });

  it('returns no entries without a workspace or when the folder is unavailable', async () => {
    vscode.workspace.workspaceFolders = [];
    await expect(listHistoryEntries(context)).resolves.toEqual([]);

    vscode.workspace.workspaceFolders = [workspace];
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockRejectedValue(new Error('missing'));
    await expect(listHistoryEntries(context)).resolves.toEqual([]);
  });

  it('clears history entries from disk and workspaceState', async () => {
    context.workspaceState.get.mockReturnValue([
      {
        id: 'abc123',
        kind: 'impact-analysis',
        title: 'Análise de impacto',
        modelName: 'Auto',
        totalTokens: 42,
        createdAt: '2026-08-14T12:34:56.789Z',
        files: ['src/example.ts'],
        path: 'code-cortex/_history/consulta-20260814123456789.md'
      }
    ]);
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({} as any);
    const deleteFile = jest.spyOn(vscode.workspace.fs, 'delete');

    await clearHistoryEntries(context);

    expect(deleteFile).toHaveBeenCalled();
    expect(context.workspaceState.update).toHaveBeenCalledWith(
      'code-cortex.history.entries',
      []
    );
  });
});
