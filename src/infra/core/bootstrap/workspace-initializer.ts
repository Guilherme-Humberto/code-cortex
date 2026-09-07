import * as vscode from 'vscode';
import { ImpactViewProvider } from '../ui/impact-view-provider';
import {
  offerPackageJsonScripts,
  provisionRepositoryDocsScript,
  watchRepositoryDocsScript
} from './pre-commit-assets.service';

export class WorkspaceInitializer {
  /**
   * Inicializa recursos relacionados ao workspace.
   */
  async initializeWorkspace(
    workspace: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ): Promise<void> {
    // retainContextWhenHidden evita recarregar o estado da webview ao esconder o painel
    const impactViewProvider = new ImpactViewProvider(context);
    context.subscriptions.push(
      vscode.window.registerWebviewViewProvider(
        'code-cortex-view',
        impactViewProvider,
        {
          webviewOptions: { retainContextWhenHidden: true }
        }
      )
    );

    // provisiona o CLI de docs de repositório e oferece os scripts de pre-commit,
    // sem bloquear a ativação da extensão em caso de falha
    void provisionRepositoryDocsScript(context, workspace)
      .then(() => offerPackageJsonScripts(context, workspace))
      .catch(error =>
        console.error(
          'CodeCortex: falha ao provisionar pre-commit assets',
          error
        )
      );

    // recria o CLI automaticamente se o usuário apagar a pasta .scripts durante a sessão
    context.subscriptions.push(watchRepositoryDocsScript(context, workspace));
  }

  /**
   * Aguarda a abertura de um workspace quando a extensão
   * é ativada sem nenhuma pasta aberta.
   */
  registerWorkspaceListener(context: vscode.ExtensionContext): void {
    // extensão ativada sem pasta aberta — aguarda o usuário abrir um workspace
    const disposable = vscode.workspace.onDidChangeWorkspaceFolders(event => {
      const workspace = event.added[0];

      if (workspace) {
        void this.initializeWorkspace(workspace, context);
      }
    });

    context.subscriptions.push(disposable);
  }

  /**
   * Retorna o workspace mais provável para inicialização.
   */
  getPreferredWorkspace(): vscode.WorkspaceFolder | undefined {
    const activeEditor = vscode.window.activeTextEditor?.document.uri;

    const workspaces = vscode.workspace.workspaceFolders ?? [];

    if (activeEditor) {
      return vscode.workspace.getWorkspaceFolder(activeEditor) ?? workspaces[0];
    }

    return workspaces[0];
  }
}
