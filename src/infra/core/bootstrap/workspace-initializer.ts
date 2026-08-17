import * as vscode from 'vscode';
import { ImpactViewProvider } from '../ui/impact-view-provider';

export class WorkspaceInitializer {
  /**
   * Inicializa recursos relacionados ao workspace.
   */
  async initializeWorkspace(
    workspace: vscode.WorkspaceFolder,
    context: vscode.ExtensionContext
  ): Promise<void> {
    console.log(`Initializing workspace: ${workspace.uri.fsPath}`);

    // Registrar provider da view tipo webview (painel lateral)
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
  }

  /**
   * Aguarda a abertura de um workspace quando a extensão
   * é ativada sem nenhuma pasta aberta.
   */
  registerWorkspaceListener(context: vscode.ExtensionContext): void {
    console.log('No workspace available. Waiting for workspace changes.');

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
