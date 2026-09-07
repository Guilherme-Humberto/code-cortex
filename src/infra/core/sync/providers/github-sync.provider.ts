import * as https from 'https';
import * as vscode from 'vscode';

import {
  DOCUMENTATION_DIRECTORY,
  KNOWLEDGE_DIRECTORY,
  MEMORY_PATH
} from '../../constants';
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

function parseGithubUrl(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com[/:]([^/\s]+)\/([^/\s]+)(?:\.git)?$/i);
  if (!match) {
    return null;
  }
  return { owner: match[1]!, repo: match[2]! };
}

function fetchJson(url: string, token?: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'vscode-code-cortex',
      Accept: 'application/vnd.github.v3+json'
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    https
      .get(url, { headers }, res => {
        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (error) {
            reject(error);
          }
        });
      })
      .on('error', reject);
  });
}

function fetchBuffer(url: string, token?: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const headers: Record<string, string> = {
      'User-Agent': 'vscode-code-cortex'
    };

    if (token) {
      headers.Authorization = `token ${token}`;
    }

    https
      .get(url, { headers }, res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(Buffer.from(chunk)));
        res.on('end', () => resolve(Buffer.concat(chunks)));
      })
      .on('error', reject);
  });
}

export async function syncFromGithubRepository(
  repoUrl: string | undefined,
  token: string | undefined
): Promise<void> {
  const normalized = repoUrl?.trim();
  if (!normalized) {
    vscode.window.showWarningMessage('Informe a URL do repositório GitHub.');
    return;
  }

  const parsed = parseGithubUrl(normalized);
  if (!parsed) {
    vscode.window.showWarningMessage(
      'URL do GitHub inválida. Use https://github.com/owner/repo'
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

  const { owner, repo } = parsed;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Sincronizando ${owner}/${repo} (usando branch default)...`,
      cancellable: false
    },
    async progress => {
      try {
        const repoInfo = await fetchJson(
          `https://api.github.com/repos/${owner}/${repo}`,
          token
        );
        const branch = repoInfo.default_branch || 'main';

        progress.report({
          message: `Obtendo lista de arquivos na branch ${branch}...`
        });

        const treeResponse = await fetchJson(
          `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
            branch
          )}?recursive=1`,
          token
        );

        const tree = treeResponse.tree || [];
        const blobs = tree.filter((entry: any) => entry.type === 'blob');
        const eligibleBlobs = blobs.filter((entry: any) =>
          isAllowedKnowledgeFile(entry.path || '')
        );
        const stats: SyncCopyStats = {
          copiedFiles: 0,
          copiedBytes: 0,
          totalBytes: 0,
          skippedUnsupportedFiles: blobs.length - eligibleBlobs.length,
          skippedBinaryFiles: 0,
          skippedOversizedFiles: 0
        };

        const targetDir = vscode.Uri.joinPath(
          workspaceFolder,
          MEMORY_PATH,
          DOCUMENTATION_DIRECTORY,
          KNOWLEDGE_DIRECTORY
        );
        await vscode.workspace.fs.createDirectory(targetDir);

        let index = 0;
        for (const blob of eligibleBlobs) {
          index++;
          progress.report({
            message: `Copiando ${blob.path} (${index}/${eligibleBlobs.length})`,
            increment: (1 / Math.max(eligibleBlobs.length, 1)) * 100
          });

          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${blob.path}`;
          try {
            const data = await fetchBuffer(rawUrl, token);
            if (data.length > KNOWLEDGE_SYNC_FILE_LIMITS.maxFileBytes) {
              stats.skippedOversizedFiles++;
              continue;
            }

            const prepared = await prepareKnowledgeFileForStorage(
              blob.path,
              data
            );

            if (
              !isDocxKnowledgeFile(blob.path) &&
              isLikelyBinaryContent(prepared.content)
            ) {
              stats.skippedBinaryFiles++;
              continue;
            }

            if (
              prepared.content.length > KNOWLEDGE_SYNC_FILE_LIMITS.maxFileBytes
            ) {
              stats.skippedOversizedFiles++;
              continue;
            }

            if (
              stats.totalBytes + prepared.content.length >
              KNOWLEDGE_SYNC_FILE_LIMITS.maxTotalBytes
            ) {
              throw new Error('KNOWLEDGE_SYNC_TOTAL_LIMIT_EXCEEDED');
            }

            const destination = vscode.Uri.joinPath(
              targetDir,
              prepared.outputPath
            );
            const parentParts = prepared.outputPath.split('/').slice(0, -1);
            if (parentParts.length > 0) {
              await vscode.workspace.fs.createDirectory(
                vscode.Uri.joinPath(targetDir, ...parentParts)
              );
            }
            await vscode.workspace.fs.writeFile(destination, prepared.content);
            stats.copiedFiles++;
            stats.copiedBytes += prepared.content.length;
            stats.totalBytes += prepared.content.length;
          } catch (error) {
            console.error('Failed to fetch file', rawUrl, error);
            if (
              error instanceof Error &&
              error.message === 'KNOWLEDGE_SYNC_TOTAL_LIMIT_EXCEEDED'
            ) {
              throw error;
            }
          }
        }

        const summary = buildSyncSummary(stats);
        vscode.window.showInformationMessage(
          summary
            ? `Sincronização GitHub concluída. Branch usada: ${branch}. ${summary}`
            : `Sincronização GitHub concluída. Branch usada: ${branch}`
        );
      } catch (error) {
        console.error('GitHub sync failed', error);
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
          'Falha ao sincronizar do GitHub. Veja o console para detalhes.'
        );
      }
    }
  );
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
