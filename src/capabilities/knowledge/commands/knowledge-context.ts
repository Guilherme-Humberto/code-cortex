import * as vscode from 'vscode';

export interface KnowledgeDocument {
  readonly path: string;
  readonly content: string;
}

export async function findMarkdownDocuments(
  folder: vscode.Uri
): Promise<KnowledgeDocument[]> {
  const documents: KnowledgeDocument[] = [];

  try {
    const entries = await vscode.workspace.fs.readDirectory(folder);

    for (const [name, type] of entries) {
      const uri = vscode.Uri.joinPath(folder, name);

      if (type === vscode.FileType.Directory) {
        documents.push(...(await findMarkdownDocuments(uri)));
        continue;
      }

      if (type !== vscode.FileType.File || !name.endsWith('.md')) {
        continue;
      }

      const content = await vscode.workspace.fs.readFile(uri);
      documents.push({
        path: uri.fsPath,
        content: Buffer.from(content).toString('utf8')
      });
    }
  } catch (error) {
    console.error(`Knowledge: failed to read ${folder.fsPath}`, error);
  }

  return documents;
}
