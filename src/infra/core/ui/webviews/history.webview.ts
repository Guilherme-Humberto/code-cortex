import * as vscode from 'vscode';

import { HistoryEntry } from '../../history/history.service';
import { createNonce } from './webview-utils';

export function buildHistoryWebviewHtml(
  webview: vscode.Webview,
  history: readonly HistoryEntry[]
): string {
  const nonce = createNonce();
  const historyJson = JSON.stringify(history).replace(/</g, '\\u003c');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Histórico completo</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 13px; }
    .topbar { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .topbar-left { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .back, .danger { min-height: 30px; padding: 6px 10px; border: 1px solid var(--vscode-panel-border); border-radius: 4px; background: transparent; color: var(--vscode-textLink-foreground); cursor: pointer; font: inherit; }
    .danger { color: var(--vscode-errorForeground); }
    .danger:hover, .back:hover { background: var(--vscode-list-hoverBackground); }
    main { padding-top: 16px; }
    h1 { margin: 0; font-size: 18px; }
    .subtitle { margin: 6px 0 0; color: var(--vscode-descriptionForeground); line-height: 1.45; }
    .list { display: grid; gap: 10px; margin-top: 16px; }
    .card { padding: 12px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: color-mix(in srgb, var(--vscode-editor-background) 55%, transparent); cursor: pointer; text-align: left; }
    .card:hover { background: var(--vscode-list-hoverBackground); }
    .card-title { font-weight: 600; }
    .card-meta { margin-top: 4px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.45; }
    .files { margin-top: 8px; color: var(--vscode-descriptionForeground); font-size: 12px; opacity: 0.9; }
    .files > div { margin-bottom: 4px; }
    .empty { padding: 18px 0; color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-left">
      <button id="back" class="back">← Voltar</button>
      <strong>Histórico completo</strong>
    </div>
    <button id="clear" class="danger">Limpar tudo</button>
  </header>
  <main>
    <h1>Consultas salvas</h1>
    <p class="subtitle">Esta lista reúne análises de impacto e pesquisas na base de conhecimento. O conteúdo permanece em <strong>code-cortex/_history</strong> e os metadados no workspaceState.</p>
    <div class="list" id="list"></div>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const history = ${historyJson};
    const list = document.getElementById('list');

    function formatDate(value) {
      try {
        return new Intl.DateTimeFormat('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short'
        }).format(new Date(value));
      } catch {
        return value;
      }
    }

    function render() {
      list.innerHTML = '';

      if (!history.length) {
        list.innerHTML = '<div class="empty">Nenhuma consulta salva ainda.</div>';
        return;
      }

      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        const card = document.createElement('button');
        card.className = 'card';
        card.addEventListener('click', () => vscode.postMessage({ command: 'openHistory', path: entry.path }));

        const title = document.createElement('div');
        title.className = 'card-title';
        const savedName = (entry.path || '').split('/').pop() || entry.title || 'Consulta sem título';
        title.textContent = (i + 1) + ') ' + savedName;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = formatDate(entry.createdAt) + ' · ' + (entry.modelName || 'Modelo não identificado') + ' · ' + (entry.totalTokens || 0) + ' tokens · ' + entry.kind;

        const files = document.createElement('div');
        files.className = 'files';
        const fileList = (entry.files && entry.files.length) ? entry.files : [entry.path];
        const maxShowFiles = 3;
        for (let i = 0; i < Math.min(fileList.length, maxShowFiles); i++) {
          const f = document.createElement('div');
          f.textContent = fileList[i];
          files.appendChild(f);
        }
        if (fileList.length === 0) {
          files.textContent = 'Sem arquivos associados';
        } else if (fileList.length > maxShowFiles) {
          const more = document.createElement('div');
          more.textContent = '...';
          files.appendChild(more);
        }

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(files);
        list.appendChild(card);
      }
    }

    document.getElementById('back').addEventListener('click', () => {
      vscode.postMessage({ command: 'historyBack' });
    });

    document.getElementById('clear').addEventListener('click', () => {
      // delegate confirmation to the extension host (shows native VS Code modal)
      vscode.postMessage({ command: 'clearHistory' });
    });

    render();
  </script>
</body>
</html>`;
}
