import * as vscode from 'vscode';

import {
  isDocxKnowledgeFile,
  prepareKnowledgeFileForStorage
} from '../../utils/knowledge-file.util';
import {
  isAllowedKnowledgeFile,
  isLikelyBinaryContent,
  KNOWLEDGE_SYNC_FILE_LIMITS
} from '../../utils/sync-file-policy.util';

interface SyncCopyStats {
  copiedFiles: number;
  copiedBytes: number;
  totalBytes: number;
  skippedUnsupportedFiles: number;
  skippedBinaryFiles: number;
  skippedOversizedFiles: number;
}

export async function syncFromLocalFolder(localPath?: string): Promise<void> {
  const normalized = localPath?.trim();
  if (!normalized) {
    vscode.window.showWarningMessage(
      'Informe o caminho local para sincronizar (ou escolha uma pasta).'
    );
    return;
  }

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!workspaceFolder) {
    vscode.window.showWarningMessage(
      'Abra uma pasta de workspace antes de sincronizar.'
    );
    return;
  }

  try {
    const source = vscode.Uri.file(normalized);
    const targetDir = vscode.Uri.joinPath(
      workspaceFolder,
      'code-cortex',
      'knowledge'
    );
    const stats: SyncCopyStats = {
      copiedFiles: 0,
      copiedBytes: 0,
      totalBytes: 0,
      skippedUnsupportedFiles: 0,
      skippedBinaryFiles: 0,
      skippedOversizedFiles: 0
    };

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Sincronizando pasta local (copiando arquivos)...',
        cancellable: false
      },
      async () => {
        await vscode.workspace.fs.createDirectory(targetDir);
        await copyFolderRecursively(source, targetDir, stats);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    );

    const summary = buildSyncSummary(stats);
    vscode.window.showInformationMessage(
      summary
        ? `Sincronização local concluída. ${summary}`
        : 'Sincronização local concluída. Arquivos copiados para code-cortex/knowledge'
    );
  } catch (error) {
    console.error('Local sync failed', error);
    if (
      error instanceof Error &&
      error.message === 'KNOWLEDGE_SYNC_TOTAL_LIMIT_EXCEEDED'
    ) {
      vscode.window.showWarningMessage(
        'Sincronização interrompida: o total de arquivos permitidos ultrapassou 50 MB.'
      );
      return;
    }
    vscode.window.showErrorMessage(
      'Falha ao sincronizar a pasta local. Veja o console para detalhes.'
    );
  }
}

async function copyFolderRecursively(
  source: vscode.Uri,
  destination: vscode.Uri,
  stats: SyncCopyStats
): Promise<void> {
  const entries = await vscode.workspace.fs.readDirectory(source);

  for (const [name, type] of entries) {
    const sourceChild = vscode.Uri.joinPath(source, name);
    const destinationChild = vscode.Uri.joinPath(destination, name);

    if (type === vscode.FileType.Directory) {
      await vscode.workspace.fs.createDirectory(destinationChild);
      await copyFolderRecursively(sourceChild, destinationChild, stats);
    } else if (type === vscode.FileType.File) {
      if (!isAllowedKnowledgeFile(name)) {
        stats.skippedUnsupportedFiles++;
        continue;
      }

      const fileStat = await vscode.workspace.fs.stat(sourceChild);
      if (fileStat.size > KNOWLEDGE_SYNC_FILE_LIMITS.maxFileBytes) {
        stats.skippedOversizedFiles++;
        continue;
      }

      const data = await vscode.workspace.fs.readFile(sourceChild);
      const prepared = await prepareKnowledgeFileForStorage(name, data);

      if (
        !isDocxKnowledgeFile(name) &&
        isLikelyBinaryContent(prepared.content)
      ) {
        stats.skippedBinaryFiles++;
        continue;
      }

      if (prepared.content.length > KNOWLEDGE_SYNC_FILE_LIMITS.maxFileBytes) {
        stats.skippedOversizedFiles++;
        continue;
      }

      if (
        stats.totalBytes + prepared.content.length >
        KNOWLEDGE_SYNC_FILE_LIMITS.maxTotalBytes
      ) {
        throw new Error('KNOWLEDGE_SYNC_TOTAL_LIMIT_EXCEEDED');
      }

      const destinationFile = vscode.Uri.joinPath(
        destination,
        prepared.outputPath
      );

      await vscode.workspace.fs.writeFile(destinationFile, prepared.content);
      stats.copiedFiles++;
      stats.copiedBytes += prepared.content.length;
      stats.totalBytes += prepared.content.length;
    }
  }
}

function buildSyncSummary(stats: SyncCopyStats): string {
  const parts = [];

  if (stats.skippedUnsupportedFiles > 0) {
    parts.push(
      `${stats.skippedUnsupportedFiles} arquivos ignorados por extensão`
    );
  }

  if (stats.skippedBinaryFiles > 0) {
    parts.push(
      `${stats.skippedBinaryFiles} arquivos ignorados por conteúdo binário`
    );
  }

  if (stats.skippedOversizedFiles > 0) {
    parts.push(
      `${stats.skippedOversizedFiles} arquivos ignorados por exceder 2 MB`
    );
  }

  return parts.join(', ');
}

export async function pickLocalFolderPath(): Promise<string> {
  const pick = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    openLabel: 'Selecionar pasta'
  });

  if (!pick || pick.length === 0) {
    return '';
  }

  const first = pick[0]!;
  return first.fsPath || (first as any).path || first.toString();
}
