import * as vscode from 'vscode';
import { DisposableStore } from '@/infra/core/bootstrap/disposable-store';

export function registerDisposable(
  ctx: vscode.ExtensionContext,
  store: DisposableStore,
  disposable: vscode.Disposable
): void {
  store.add(disposable);
  ctx.subscriptions.push(disposable);
}
