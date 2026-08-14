import * as vscode from 'vscode';

export interface PathMergeResult {
  readonly paths: string[];
  readonly added: number;
}

export function toUris(value: unknown): vscode.Uri[] {
  if (Array.isArray(value)) {
    return value.filter(isUri);
  }

  return isUri(value) ? [value] : [];
}

export function getActiveEditorUri(): vscode.Uri[] {
  const uri = vscode.window.activeTextEditor?.document.uri;
  return uri ? [uri] : [];
}

export function getPathFromCommandArgument(value: unknown): string | undefined {
  if (typeof value === 'string') {
    return value;
  }

  if (isRecord(value) && typeof value.label === 'string') {
    return value.label;
  }

  return undefined;
}

export function mergePaths(
  current: readonly string[],
  additions: readonly string[]
): PathMergeResult {
  const paths = [...current];
  const existing = new Set(paths);
  let added = 0;

  for (const path of additions) {
    if (existing.has(path)) {
      continue;
    }

    existing.add(path);
    paths.push(path);
    added++;
  }

  return { paths, added };
}

function isUri(value: unknown): value is vscode.Uri {
  return value instanceof vscode.Uri;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
