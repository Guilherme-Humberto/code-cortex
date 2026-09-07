import * as vscode from 'vscode';

import {
  CodeCortexBlock,
  extractCodeCortexBlocks
} from '../parser/code-cortex-block-parser';
import {
  hasAllowedExtension,
  IGNORED_DIRECTORIES,
  MAX_FILE_BYTES
} from './code-cortex-scan-policy';

export interface ScannedCodeCortexBlock extends CodeCortexBlock {
  readonly sourceFile: string;
}

/**
 * Varre recursivamente uma pasta em busca de blocos `@code_cortex`
 * em arquivos de código-fonte.
 */
export async function scanForCodeCortexBlocks(
  rootFolder: vscode.Uri
): Promise<ScannedCodeCortexBlock[]> {
  const results: ScannedCodeCortexBlock[] = [];
  await walk(rootFolder, results);
  return results;
}

async function walk(
  folder: vscode.Uri,
  results: ScannedCodeCortexBlock[]
): Promise<void> {
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(folder);
  } catch (error) {
    console.error(`RepositoryDocs: failed to read ${folder.fsPath}`, error);
    return;
  }

  for (const [name, type] of entries) {
    if (type === vscode.FileType.Directory) {
      if (IGNORED_DIRECTORIES.has(name)) {
        continue;
      }
      await walk(vscode.Uri.joinPath(folder, name), results);
      continue;
    }

    if (type !== vscode.FileType.File || !hasAllowedExtension(name)) {
      continue;
    }

    await collectBlocksFromFile(vscode.Uri.joinPath(folder, name), results);
  }
}

async function collectBlocksFromFile(
  fileUri: vscode.Uri,
  results: ScannedCodeCortexBlock[]
): Promise<void> {
  try {
    const stat = await vscode.workspace.fs.stat(fileUri);
    if (stat.size > MAX_FILE_BYTES) {
      return;
    }

    const data = await vscode.workspace.fs.readFile(fileUri);
    const content = Buffer.from(data).toString('utf8');
    if (!content.includes('@code_cortex')) {
      return;
    }

    const sourceFile = vscode.workspace.asRelativePath(fileUri, false);
    for (const block of extractCodeCortexBlocks(content)) {
      results.push({ ...block, sourceFile });
    }
  } catch (error) {
    console.error(`RepositoryDocs: failed to read ${fileUri.fsPath}`, error);
  }
}
