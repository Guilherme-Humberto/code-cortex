import * as vscode from 'vscode';

import { registerImpactCommands } from './impact/impact.command';

/**
 * Registra todos os comandos disponibilizados pela extensão.
 */
export function registerCoreCommands(ctx: vscode.ExtensionContext): void {
  registerImpactCommands(ctx);
}
