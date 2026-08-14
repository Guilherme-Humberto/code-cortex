import * as vscode from 'vscode';

import {
  getActiveEditorUri,
  getPathFromCommandArgument,
  mergePaths,
  toUris
} from '../file-selection';

describe('file-selection', () => {
  it('normalizes a single URI and an array of URIs', () => {
    const first = new vscode.Uri('/workspace/first.ts');
    const second = new vscode.Uri('/workspace/second.ts');

    expect(toUris(first)).toEqual([first]);
    expect(toUris([first, 'invalid', second])).toEqual([first, second]);
    expect(toUris(undefined)).toEqual([]);
  });

  it('gets the active editor URI when available', () => {
    const uri = new vscode.Uri('/workspace/active.ts');
    vscode.window.activeTextEditor = { document: { uri } };

    expect(getActiveEditorUri()).toEqual([uri]);

    vscode.window.activeTextEditor = undefined;
    expect(getActiveEditorUri()).toEqual([]);
  });

  it('extracts removal paths from strings and tree items', () => {
    expect(getPathFromCommandArgument('src/file.ts')).toBe('src/file.ts');
    expect(getPathFromCommandArgument({ label: 'src/file.ts' })).toBe(
      'src/file.ts'
    );
    expect(getPathFromCommandArgument({ label: 42 })).toBeUndefined();
    expect(getPathFromCommandArgument(null)).toBeUndefined();
  });

  it('merges only new paths and reports the count', () => {
    expect(mergePaths(['a.ts'], ['a.ts', 'b.ts', 'b.ts'])).toEqual({
      paths: ['a.ts', 'b.ts'],
      added: 1
    });
  });
});
