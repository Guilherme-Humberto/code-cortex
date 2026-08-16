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
  console.log('Code Cortex extension is activating...');

  const workspace = workspaceInitializer.getPreferredWorkspace();

  if (workspace) {
    workspaceInitializer.initializeWorkspace(workspace, context);
  } else {
    workspaceInitializer.registerWorkspaceListener(context);
  }

  registerSearchKnowledgeCommand(context, disposables);
  registerCoreCommands(context);

  console.log('Code Cortex extension activated.');
}

/**
 * Finaliza recursos da extensão.
 */
export async function deactivate(): Promise<void> {
  console.log('Code Cortex extension deactivating...');

  try {
    if (!disposables.isDisposed) {
      disposables.dispose();
    }
  } catch (error) {
    console.error('Error disposing extension resources:', error);
  }

  console.log('Code Cortex extension deactivated.');
}
