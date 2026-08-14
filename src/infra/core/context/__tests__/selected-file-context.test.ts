import * as vscode from 'vscode';

import {
  collectSelectedFileContext,
  SELECTED_FILE_CONTEXT_LIMITS
} from '../selected-file-context';

describe('selected-file-context', () => {
  const workspace = {
    uri: new vscode.Uri('/workspace')
  } as vscode.WorkspaceFolder;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reads text files and detects their language', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValue(Buffer.from('const value = 1;'));

    await expect(
      collectSelectedFileContext(workspace, ['src/example.ts'])
    ).resolves.toEqual([
      {
        path: 'src/example.ts',
        language: 'typescript',
        content: 'const value = 1;',
        truncated: false
      }
    ]);
  });

  it('truncates each file and the total context budget', async () => {
    const content = 'x'.repeat(
      SELECTED_FILE_CONTEXT_LIMITS.maxCharactersPerFile + 100
    );
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValue(Buffer.from(content));

    const result = await collectSelectedFileContext(workspace, [
      'one.unknown',
      'two.unknown',
      'three.unknown',
      'four.unknown',
      'five.unknown'
    ]);

    expect(result).toHaveLength(4);
    expect(result[0]?.language).toBe('text');
    expect(result[0]?.content).toHaveLength(
      SELECTED_FILE_CONTEXT_LIMITS.maxCharactersPerFile
    );
    expect(result[0]?.truncated).toBe(true);
    expect(result.reduce((total, file) => total + file.content.length, 0)).toBe(
      SELECTED_FILE_CONTEXT_LIMITS.maxCharactersTotal
    );
  });

  it('limits the number of files and skips binary files', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockImplementation(async uri => {
        if (uri.fsPath.endsWith('binary.ts')) {
          return Buffer.from('text\u0000binary');
        }
        return Buffer.from('content');
      });

    const paths = [
      'binary.ts',
      ...Array.from({ length: 10 }, (_, i) => `${i}.ts`)
    ];
    const result = await collectSelectedFileContext(workspace, paths);

    expect(result).toHaveLength(7);
    expect(result.every(file => file.path !== 'binary.ts')).toBe(true);
  });

  it('continues when a file cannot be read', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockRejectedValueOnce(new Error('read failed'));

    await expect(
      collectSelectedFileContext(workspace, ['missing.ts', 'valid.ts'])
    ).resolves.toHaveLength(1);
  });
});
