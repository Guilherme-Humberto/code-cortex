import * as vscode from 'vscode';

import { registerSearchKnowledgeCommand } from './search-knowledge.command';
import { DisposableStore } from '@/infra/core/bootstrap/disposable-store';

/**
 * Registra todos os comandos disponibilizados pela extensão.
 */
export function registerCommands(
  ctx: vscode.ExtensionContext,
  store: DisposableStore
): void {
  registerSearchKnowledgeCommand(ctx, store);
}
