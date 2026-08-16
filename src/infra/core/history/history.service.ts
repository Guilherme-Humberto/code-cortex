import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';

const HISTORY_STATE_KEY = 'code-cortex.history.entries';
const HISTORY_DIRECTORY = 'code-cortex/_history';

export type HistoryEntryKind =
  'impact-analysis' | 'knowledge-search' | 'manual';

export interface HistoryEntry {
  readonly id: string;
  readonly kind: HistoryEntryKind;
  readonly title: string;
  readonly modelName: string;
  readonly totalTokens: number;
  readonly createdAt: string;
  readonly files: readonly string[];
  readonly path: string;
}

export interface HistoryMetadata {
  readonly kind: HistoryEntryKind;
  readonly title: string;
  readonly modelName: string;
  readonly totalTokens: number;
  readonly files: readonly string[];
}

export interface HistoryListOptions {
  readonly limit?: number;
}

export async function saveHistoryEntry(
  context: vscode.ExtensionContext,
  markdown: string,
  metadata: HistoryMetadata
): Promise<string> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    throw new Error('Nenhum workspace encontrado.');
  }

  const directory = vscode.Uri.joinPath(workspace.uri, HISTORY_DIRECTORY);
  await vscode.workspace.fs.createDirectory(directory);
  // always create a new history entry (no contentHash dedupe)

  const id = createHistoryId();
  const createdAt = new Date().toISOString();
  const fileName = createHistoryFileName(new Date(), id);
  const fileUri = vscode.Uri.joinPath(directory, fileName);
  const content = [
    '---',
    `id: ${id}`,
    `kind: ${metadata.kind}`,
    `title: ${escapeFrontmatterValue(metadata.title)}`,
    `model: ${metadata.modelName}`,
    `estimatedTokens: ${metadata.totalTokens}`,
    `createdAt: ${createdAt}`,
    'files:',
    ...metadata.files.map(file => `  - ${file}`),
    '---',
    '',
    markdown
  ].join('\n');

  await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));

  const entry: HistoryEntry = {
    id,
    kind: metadata.kind,
    title: metadata.title,
    modelName: metadata.modelName,
    totalTokens: metadata.totalTokens,
    createdAt,
    files: [...metadata.files],
    path: `${HISTORY_DIRECTORY}/${fileName}`
  };

  await context.workspaceState.update(HISTORY_STATE_KEY, [
    entry,
    ...getHistoryState(context).filter(item => item.path !== entry.path)
  ]);

  return entry.path;
}

export async function listHistoryEntries(
  context: vscode.ExtensionContext,
  options: HistoryListOptions = {}
): Promise<HistoryEntry[]> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    return [];
  }

  const state = await ensureHydratedHistoryEntries(context, workspace.uri);
  const valid = await pruneMissingHistoryEntries(context, workspace.uri, state);
  const sorted = [...valid].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt)
  );

  return typeof options.limit === 'number'
    ? sorted.slice(0, options.limit)
    : sorted;
}

export async function clearHistoryEntries(
  context: vscode.ExtensionContext
): Promise<void> {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    await context.workspaceState.update(HISTORY_STATE_KEY, []);
    return;
  }

  const entries = await listHistoryEntries(context);
  await Promise.all(
    entries.map(async entry => {
      try {
        await vscode.workspace.fs.delete(
          vscode.Uri.joinPath(workspace.uri, entry.path),
          { useTrash: false }
        );
      } catch {
        return;
      }
    })
  );
  await context.workspaceState.update(HISTORY_STATE_KEY, []);
}

function createHistoryFileName(date: Date, id: string): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const ymd = `${yyyy}${mm}${dd}`;
  return `${ymd}_${id}.md`;
}

function createHistoryId(): string {
  return randomBytes(3).toString('hex');
}

function getHistoryState(context: vscode.ExtensionContext): HistoryEntry[] {
  return context.workspaceState.get<HistoryEntry[]>(HISTORY_STATE_KEY, []);
}

async function ensureHydratedHistoryEntries(
  context: vscode.ExtensionContext,
  workspaceUri: vscode.Uri
): Promise<HistoryEntry[]> {
  const state = getHistoryState(context);
  if (state.length > 0) {
    return state;
  }

  const directory = vscode.Uri.joinPath(workspaceUri, HISTORY_DIRECTORY);
  try {
    const entries = await vscode.workspace.fs.readDirectory(directory);
    const hydrated = await Promise.all(
      entries
        .filter(
          ([name, type]) =>
            type === vscode.FileType.File && name.endsWith('.md')
        )
        .map(async ([name]) => {
          const fileUri = vscode.Uri.joinPath(directory, name);
          const content = Buffer.from(
            await vscode.workspace.fs.readFile(fileUri)
          ).toString('utf8');
          const parsed = parseHistoryFile(name, content);
          return parsed;
        })
    );

    const valid = hydrated.filter((entry): entry is HistoryEntry =>
      Boolean(entry)
    );
    if (valid.length > 0) {
      await context.workspaceState.update(HISTORY_STATE_KEY, valid);
    }

    return valid;
  } catch {
    return [];
  }
}

async function pruneMissingHistoryEntries(
  context: vscode.ExtensionContext,
  workspaceUri: vscode.Uri,
  entries: readonly HistoryEntry[]
): Promise<HistoryEntry[]> {
  const valid: HistoryEntry[] = [];

  for (const entry of entries) {
    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.joinPath(workspaceUri, entry.path)
      );
      valid.push(entry);
    } catch {
      continue;
    }
  }

  if (valid.length !== entries.length) {
    await context.workspaceState.update(HISTORY_STATE_KEY, valid);
  }

  return valid;
}

function parseHistoryFile(
  fileName: string,
  content: string
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
    data[currentKey] = [match[2]!];
  }

  let id = firstValue(data.id);
  const kind = (firstValue(data.kind) as HistoryEntryKind) || 'manual';
  const title = firstValue(data.title) || fileName;
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
      id = createHistoryId();
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
    modelName,
    totalTokens,
    createdAt,
    files,
    path: `${HISTORY_DIRECTORY}/${fileName}`
  };
}

function firstValue(values?: string[]): string {
  return values && values.length > 0 ? values[0]! : '';
}

function escapeFrontmatterValue(value: string): string {
  return value.replace(/\n/g, ' ').trim();
}

// deduplication by contentHash removed
