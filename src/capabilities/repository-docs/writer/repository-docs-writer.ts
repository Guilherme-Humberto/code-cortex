import * as vscode from 'vscode';

import {
  DOCUMENTATION_DIRECTORY,
  MEMORY_PATH,
  REPOSITORY_DOCS_DIRECTORY
} from '@/infra/core/constants';
import { ScannedCodeCortexBlock } from '../scanner/repository-docs-scanner';
import { buildMarkdown, createUniqueSlug } from './repository-docs-markdown';

export interface WriteRepositoryDocsResult {
  readonly directory: string;
  readonly written: number;
}

/**
 * Regenera a pasta code-cortex/documentation/repository a partir dos blocos
 * encontrados na última varredura (o conteúdo é sempre derivado do código).
 */
export async function writeRepositoryDocs(
  workspaceRoot: vscode.Uri,
  blocks: readonly ScannedCodeCortexBlock[]
): Promise<WriteRepositoryDocsResult> {
  const targetDir = vscode.Uri.joinPath(
    workspaceRoot,
    MEMORY_PATH,
    DOCUMENTATION_DIRECTORY,
    REPOSITORY_DOCS_DIRECTORY
  );

  await vscode.workspace.fs.createDirectory(targetDir);
  await clearMarkdownFiles(targetDir);

  const usedSlugs = new Map<string, number>();
  const generatedAt = new Date().toISOString();

  for (const block of blocks) {
    const slug = createUniqueSlug(block.title, usedSlugs);
    const fileUri = vscode.Uri.joinPath(targetDir, `${slug}.md`);
    const markdown = buildMarkdown(block, generatedAt);
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(markdown, 'utf8'));
  }

  return {
    directory: `${MEMORY_PATH}/${DOCUMENTATION_DIRECTORY}/${REPOSITORY_DOCS_DIRECTORY}`,
    written: blocks.length
  };
}

async function clearMarkdownFiles(directory: vscode.Uri): Promise<void> {
  try {
    const entries = await vscode.workspace.fs.readDirectory(directory);
    await Promise.all(
      entries
        .filter(
          ([name, type]) =>
            type === vscode.FileType.File && name.endsWith('.md')
        )
        .map(([name]) =>
          vscode.workspace.fs.delete(vscode.Uri.joinPath(directory, name), {
            useTrash: false
          })
        )
    );
  } catch {
    // diretório ainda não existe na primeira execução
  }
}
