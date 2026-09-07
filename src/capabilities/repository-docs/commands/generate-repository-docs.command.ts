import * as vscode from 'vscode';

import { DisposableStore } from '@/infra/core/bootstrap/disposable-store';
import { registerDisposable } from '@/infra/core/utils/register-disposable.utils';
import { scanForCodeCortexBlocks } from '../scanner/repository-docs-scanner';
import { writeRepositoryDocs } from '../writer/repository-docs-writer';

/**
 * Registra o comando que gera documentação Markdown a partir de blocos
 * `@code_cortex` encontrados em uma pasta escolhida pelo usuário.
 */
export function registerGenerateRepositoryDocsCommand(
  ctx: vscode.ExtensionContext,
  store: DisposableStore
): void {
  const disposable = vscode.commands.registerCommand(
    'codeCortex_repositoryDocs_generate',
    async () => {
      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) {
        vscode.window.showErrorMessage('Nenhum workspace encontrado.');
        return;
      }

      const rootFolder = await pickScanFolder(workspace.uri);
      if (!rootFolder) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Gerando documentação a partir do código...',
          cancellable: false
        },
        async () => {
          const blocks = await scanForCodeCortexBlocks(rootFolder);

          if (blocks.length === 0) {
            vscode.window.showInformationMessage(
              'Nenhum bloco @code_cortex foi encontrado na pasta selecionada.'
            );
            return;
          }

          const result = await writeRepositoryDocs(workspace.uri, blocks);
          vscode.window.showInformationMessage(
            `Documentação gerada: ${result.written} bloco(s) em ${result.directory}.`
          );
        }
      );
    }
  );

  registerDisposable(ctx, store, disposable);
}

async function pickScanFolder(
  defaultUri: vscode.Uri
): Promise<vscode.Uri | undefined> {
  const pick = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    defaultUri,
    openLabel: 'Selecionar pasta para escanear'
  });

  return pick?.[0];
}
