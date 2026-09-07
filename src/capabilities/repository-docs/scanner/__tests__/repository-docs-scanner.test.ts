import * as vscode from 'vscode';

import { scanForCodeCortexBlocks } from '../repository-docs-scanner';

describe('repository-docs-scanner', () => {
  const root = new vscode.Uri('/workspace');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('scans recursively, skips ignored directories and collects blocks from allowed files', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace') {
          return [
            ['src', vscode.FileType.Directory],
            ['node_modules', vscode.FileType.Directory]
          ] as any;
        }
        if (uri.fsPath === '/workspace/src') {
          return [
            ['controller.ts', vscode.FileType.File],
            ['image.png', vscode.FileType.File]
          ] as any;
        }
        throw new Error(`unexpected directory read: ${uri.fsPath}`);
      });

    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({
      size: 100
    } as any);

    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockImplementation(async (uri: vscode.Uri) => {
        if (uri.fsPath === '/workspace/src/controller.ts') {
          return Buffer.from(
            '/**\n * @code_cortex open\n * @title Bloco de teste\n * @code_cortex close\n */'
          );
        }
        throw new Error(`unexpected file read: ${uri.fsPath}`);
      });

    jest
      .spyOn(vscode.workspace, 'asRelativePath')
      .mockImplementation((uri: vscode.Uri) =>
        uri.fsPath.replace('/workspace/', '')
      );

    const blocks = await scanForCodeCortexBlocks(root);

    expect(blocks).toEqual([
      {
        title: 'Bloco de teste',
        description: undefined,
        links: [],
        content: '',
        sourceFile: 'src/controller.ts'
      }
    ]);
    // node_modules nunca deve ser lido
    expect(vscode.workspace.fs.readDirectory).not.toHaveBeenCalledWith(
      expect.objectContaining({ fsPath: '/workspace/node_modules' })
    );
  });

  it('skips files without the @code_cortex marker without reading their full content twice', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockResolvedValue([['plain.ts', vscode.FileType.File]] as any);
    jest.spyOn(vscode.workspace.fs, 'stat').mockResolvedValue({
      size: 10
    } as any);
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValue(Buffer.from('export const x = 1;'));

    await expect(scanForCodeCortexBlocks(root)).resolves.toEqual([]);
  });

  it('returns an empty list when the root folder cannot be read', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockRejectedValue(new Error('folder unavailable'));

    await expect(scanForCodeCortexBlocks(root)).resolves.toEqual([]);
  });
});
