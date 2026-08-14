import * as vscode from 'vscode';

import { findMarkdownDocuments } from '../knowledge-context';

describe('knowledge-context', () => {
  const root = new vscode.Uri('/workspace/code-cortex/knowledge');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recursively reads Markdown files and ignores other file types', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockImplementation(async uri => {
        if (uri.fsPath.endsWith('knowledge')) {
          return [
            ['orders', vscode.FileType.Directory],
            ['notes.txt', vscode.FileType.File]
          ] as any;
        }
        return [['cancel.md', vscode.FileType.File]] as any;
      });
    jest
      .spyOn(vscode.workspace.fs, 'readFile')
      .mockResolvedValue(Buffer.from('functional rule'));

    await expect(findMarkdownDocuments(root)).resolves.toEqual([
      {
        path: '/workspace/code-cortex/knowledge/orders/cancel.md',
        content: 'functional rule'
      }
    ]);
  });

  it('returns an empty list when the knowledge folder cannot be read', async () => {
    jest
      .spyOn(vscode.workspace.fs, 'readDirectory')
      .mockRejectedValue(new Error('folder unavailable'));

    await expect(findMarkdownDocuments(root)).resolves.toEqual([]);
  });
});
