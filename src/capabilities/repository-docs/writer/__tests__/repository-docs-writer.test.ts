import * as vscode from 'vscode';

import { writeRepositoryDocs } from '../repository-docs-writer';

describe('repository-docs-writer', () => {
  const workspaceRoot = new vscode.Uri('/workspace');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('clears previous Markdown files and writes one file per block', async () => {
    jest.spyOn(vscode.workspace.fs, 'readDirectory').mockResolvedValue([
      ['old.md', vscode.FileType.File],
      ['keep.txt', vscode.FileType.File]
    ] as any);
    const createDirectory = jest.spyOn(vscode.workspace.fs, 'createDirectory');
    const deleteFile = jest.spyOn(vscode.workspace.fs, 'delete');
    const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');

    const result = await writeRepositoryDocs(workspaceRoot, [
      {
        title: 'Cancelar agendamentos',
        links: ['src/a.ts'],
        content: 'Conteúdo.',
        sourceFile: 'src/a.ts'
      },
      {
        title: 'Cancelar agendamentos',
        links: [],
        content: 'Outro bloco com o mesmo título.',
        sourceFile: 'src/b.ts'
      }
    ]);

    expect(createDirectory).toHaveBeenCalledWith(
      expect.objectContaining({
        fsPath: '/workspace/code-cortex/documentation/repository'
      })
    );
    expect(deleteFile).toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: expect.stringContaining('old.md') }),
      { useTrash: false }
    );
    expect(deleteFile).not.toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: expect.stringContaining('keep.txt') }),
      expect.anything()
    );

    expect(writeFile).toHaveBeenCalledTimes(2);
    const writtenNames = writeFile.mock.calls.map(([uri]) =>
      (uri as vscode.Uri).fsPath.split('/').pop()
    );
    expect(writtenNames).toEqual([
      'cancelar-agendamentos.md',
      'cancelar-agendamentos-1.md'
    ]);

    expect(result).toEqual({
      directory: 'code-cortex/documentation/repository',
      written: 2
    });
  });

  it('does not fail when the target directory does not exist yet', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockRejectedValue(new Error('ENOENT'));
    jest.spyOn(vscode.workspace.fs, 'writeFile').mockResolvedValue(undefined);

    await expect(writeRepositoryDocs(workspaceRoot, [])).resolves.toEqual({
      directory: 'code-cortex/documentation/repository',
      written: 0
    });
  });
});
