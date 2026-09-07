// Parsing puro (sem dependência de `vscode`) do frontmatter dos arquivos de
// histórico, reutilizado pelo history.service.ts e pelo CLI de pre-commit.

import * as path from 'node:path';

export type HistoryEntryKind =
  'impact-analysis' | 'knowledge-search' | 'manual';

export interface HistoryEntry {
  readonly id: string;
  readonly kind: HistoryEntryKind;
  readonly title: string;
  readonly summary?: string;
  readonly modelName: string;
  readonly totalTokens: number;
  readonly createdAt: string;
  readonly files: readonly string[];
  readonly path: string;
}

export function parseHistoryFile(
  fileName: string,
  content: string,
  historyDirectory: string
): HistoryEntry | null {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
  const lines = frontmatterMatch ? frontmatterMatch[1]!.split('\n') : [];
  const data: Record<string, string[]> = {};
  let currentKey: string | null = null;

  for (const line of lines) {
    if (/^\s+-\s+/.test(line) && currentKey) {
      data[currentKey] ??= [];
      data[currentKey]!.push(line.replace(/^\s+-\s+/, ''));
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      continue;
    }

    currentKey = match[1]!;
    const inlineValue = match[2];
    data[currentKey] = inlineValue ? [inlineValue] : [];
  }

  let id = firstValue(data.id);
  const kind = (firstValue(data.kind) as HistoryEntryKind) || 'manual';
  const title = firstValue(data.title) || fileName;
  const summary = firstValue(data.summary) || undefined;
  const modelName = firstValue(data.model) || 'Modelo não identificado';
  const totalTokens = Number(firstValue(data.estimatedTokens) || 0);
  let createdAt = firstValue(data.createdAt);
  const files = data.files ?? [];

  // try to extract id and timestamp from filename when missing
  if (!id) {
    const match = fileName.match(/_([a-f0-9]{6})\.md$/i);
    if (match) {
      id = match[1]!;
    } else {
      id = path.basename(fileName, '.md');
    }
  }

  if (!createdAt) {
    const timestampMatch = fileName.match(/^(\d{8})_/);
    if (timestampMatch) {
      const ts = timestampMatch[1]!;
      try {
        const year = Number(ts.slice(0, 4));
        const month = Number(ts.slice(4, 6)) - 1;
        const day = Number(ts.slice(6, 8));
        createdAt = new Date(year, month, day).toISOString();
      } catch {
        createdAt = new Date().toISOString();
      }
    } else {
      createdAt = new Date().toISOString();
    }
  }

  return {
    id,
    kind,
    title,
    summary,
    modelName,
    totalTokens,
    createdAt,
    files,
    path: `${historyDirectory}/${fileName}`
  };
}

function firstValue(values?: string[]): string {
  return values && values.length > 0 ? values[0]! : '';
}
