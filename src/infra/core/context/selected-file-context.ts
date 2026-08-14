import * as vscode from 'vscode';

export const SELECTED_FILE_CONTEXT_LIMITS = {
  maxFiles: 8,
  maxCharactersPerFile: 3000,
  maxCharactersTotal: 12000,
  maxPromptTokens: 3500
} as const;

export interface SelectedFileContext {
  readonly path: string;
  readonly language: string;
  readonly content: string;
  readonly truncated: boolean;
}

export async function collectSelectedFileContext(
  workspace: vscode.WorkspaceFolder,
  paths: readonly string[]
): Promise<SelectedFileContext[]> {
  const contexts: SelectedFileContext[] = [];
  let totalCharacters = 0;

  for (const relativePath of paths.slice(
    0,
    SELECTED_FILE_CONTEXT_LIMITS.maxFiles
  )) {
    if (totalCharacters >= SELECTED_FILE_CONTEXT_LIMITS.maxCharactersTotal) {
      break;
    }

    try {
      const uri = vscode.Uri.joinPath(workspace.uri, relativePath);
      const bytes = await vscode.workspace.fs.readFile(uri);
      const content = Buffer.from(bytes).toString('utf8');

      if (content.includes('\u0000')) {
        continue;
      }

      const remainingCharacters =
        SELECTED_FILE_CONTEXT_LIMITS.maxCharactersTotal - totalCharacters;
      const characterLimit = Math.min(
        SELECTED_FILE_CONTEXT_LIMITS.maxCharactersPerFile,
        remainingCharacters
      );

      contexts.push({
        path: relativePath,
        language: detectLanguage(relativePath),
        content: content.slice(0, characterLimit),
        truncated: content.length > characterLimit
      });
      totalCharacters += Math.min(content.length, characterLimit);
    } catch (error) {
      console.warn(`Context: failed to read ${relativePath}`, error);
    }
  }

  return contexts;
}

function detectLanguage(relativePath: string): string {
  const extension = relativePath.split('.').pop()?.toLowerCase();
  const languages: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    py: 'python',
    java: 'java',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    json: 'json',
    md: 'markdown',
    css: 'css',
    html: 'html'
  };

  return languages[extension ?? ''] ?? 'text';
}
