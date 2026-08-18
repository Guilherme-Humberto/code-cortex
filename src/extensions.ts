import * as vscode from 'vscode';

import { DisposableStore } from './infra/core/bootstrap/disposable-store';
import { WorkspaceInitializer } from './infra/core/bootstrap/workspace-initializer';
import { registerSearchKnowledgeCommand } from './capabilities/knowledge/commands/search-knowledge.command';
import { registerCoreCommands } from './infra/core/commands/command.registry';

const disposables = new DisposableStore();
const workspaceInitializer = new WorkspaceInitializer();

/**
 * Ponto de entrada da extensão.
 */
export async function activate(
  context: vscode.ExtensionContext
): Promise<void> {
  const workspace = workspaceInitializer.getPreferredWorkspace();

  // registra o provider da view ou aguarda um workspace ser aberto
  if (workspace) {
    workspaceInitializer.initializeWorkspace(workspace, context);
  } else {
    workspaceInitializer.registerWorkspaceListener(context);
  }

  registerSearchKnowledgeCommand(context, disposables);
  registerCoreCommands(context);
}

/**
 * Finaliza recursos da extensão.
 */
export async function deactivate(): Promise<void> {
  try {
    if (!disposables.isDisposed) {
      disposables.dispose();
    }
  } catch (error) {
    console.error('Falha ao liberar recursos da extensão:', error);
  }
}
