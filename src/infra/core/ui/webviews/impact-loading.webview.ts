import * as vscode from 'vscode';

import { createNonce, serializeWebviewJson } from './webview-utils';

export function buildImpactLoadingWebviewHtml(
  _webview: vscode.Webview,
  message: string
): string {
  const nonce = createNonce();
  const messageJson = serializeWebviewJson(message);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeCortex</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { min-height: calc(100vh - 24px); display: grid; place-items: center; margin: 0; padding: 24px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 13px; text-align: center; }
    .loading { max-width: 280px; }
    .spinner { width: 28px; height: 28px; margin: 0 auto 16px; border: 3px solid var(--vscode-panel-border); border-top-color: var(--vscode-textLink-foreground); border-radius: 50%; animation: spin 0.9s linear infinite; }
    p { margin: 0; color: var(--vscode-descriptionForeground); line-height: 1.5; }
    button { margin-top: 16px; min-height: 30px; padding: 6px 12px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: transparent; color: var(--vscode-foreground); cursor: pointer; font: inherit; }
    button:hover { background: var(--vscode-list-hoverBackground); }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main class="loading" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <p id="message"></p>
    <button id="cancel" type="button">Cancelar</button>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('message').textContent = ${messageJson};
    document.getElementById('cancel').addEventListener('click', () => {
      document.getElementById('cancel').disabled = true;
      vscode.postMessage({ command: 'cancelAnalysis' });
    });
  </script>
</body>
</html>`;
}
