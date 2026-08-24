import * as vscode from 'vscode';

// Registro da requisição de LLM em andamento — permite que a tela de loading
// cancele qualquer fluxo (análise de impacto ou pesquisa na base de conhecimento).
let ongoingTokenSource: vscode.CancellationTokenSource | undefined;

export function setOngoingRequest(
  tokenSource: vscode.CancellationTokenSource
): void {
  ongoingTokenSource = tokenSource;
}

export function clearOngoingRequest(
  tokenSource: vscode.CancellationTokenSource
): void {
  if (ongoingTokenSource === tokenSource) {
    ongoingTokenSource = undefined;
  }
}

export function cancelOngoingRequest(): boolean {
  if (!ongoingTokenSource) {
    return false;
  }
  ongoingTokenSource.cancel();
  return true;
}
