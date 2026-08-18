import * as vscode from 'vscode';

import { HistoryEntry } from '../../history/history.service';
import { createNonce } from './webview-utils';

export function buildHistoryWebviewHtml(
  webview: vscode.Webview,
  history: readonly HistoryEntry[],
  filterLabel?: string,
  filterPath?: string
): string {
  const nonce = createNonce();
  const historyJson = JSON.stringify(history).replace(/</g, '\\u003c');
  const filterPathJson = JSON.stringify(filterPath ?? null).replace(
    /</g,
    '\\u003c'
  );

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
    .date-sep { margin: 18px 0 6px; text-align: center; color: var(--vscode-descriptionForeground); font-size: 13px; font-weight: 600; }
    .date-sep::before { content: ''; display: block; height: 1px; background: var(--vscode-panel-border); margin-bottom: 8px; opacity: 0.9; }
    .card { padding: 12px 48px 12px 12px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: color-mix(in srgb, var(--vscode-editor-background) 55%, transparent); cursor: pointer; text-align: left; position: relative; }
    .card:hover { background: var(--vscode-list-hoverBackground); }
    .card-title { font-weight: 600; }
    .card-meta { margin-top: 4px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.45; }
    .files { margin-top: 8px; color: var(--vscode-descriptionForeground); font-size: 12px; opacity: 0.9; }
    .files > div { margin-bottom: 4px; }
    .empty { padding: 18px 0; color: var(--vscode-descriptionForeground); }
    .highlight { background: color-mix(in srgb, rgba(255,255,0,0.25) 60%, transparent); padding: 2px 4px; border-radius: 3px; }
    .remove-btn { position: absolute; top: 12px; right: 12px; border: 1px solid var(--vscode-panel-border); background: transparent; color: var(--vscode-errorForeground); cursor: pointer; padding: 6px; border-radius: 6px; }
    .remove-btn:hover { background: var(--vscode-list-hoverBackground); }
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
    <p class="subtitle">Esta lista reúne pesquisas na base de conhecimento.</p>
    ${filterLabel ? `<p class="subtitle">${filterLabel}</p>` : ''}
    <div class="list" id="list"></div>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const history = ${historyJson};
    const filterPath = ${filterPathJson};
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

      let prevDate = null;
      for (let i = 0; i < history.length; i++) {
        const entry = history[i];
        const dateKey = (function(v) {
          try {
            return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(new Date(v));
          } catch { return String(v); }
        })(entry.createdAt);

        if (dateKey !== prevDate) {
          const sep = document.createElement('div');
          sep.className = 'date-sep';
          sep.textContent = dateKey;
          list.appendChild(sep);
          prevDate = dateKey;
        }
        const card = document.createElement('div');
        card.className = 'card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.addEventListener('click', () => vscode.postMessage({ command: 'openHistory', path: entry.path }));
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { vscode.postMessage({ command: 'openHistory', path: entry.path }); } });

        const title = document.createElement('div');
        title.className = 'card-title';
        const savedName = (entry.path || '').split('/').pop() || entry.title || 'Consulta sem título';
        title.textContent = (history.length - i) + ') ' + savedName;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = formatDate(entry.createdAt) + ' · ' + (entry.modelName || 'Modelo não identificado') + ' · ' + (entry.totalTokens || 0) + ' tokens · ' + entry.kind;

        const files = document.createElement('div');
        files.className = 'files';
        const fileList = (entry.files && entry.files.length) ? entry.files : [entry.path];
        const maxShowFiles = 3;
        for (let i = 0; i < Math.min(fileList.length, maxShowFiles); i++) {
          const f = document.createElement('div');
          const fileName = fileList[i];
          if (filterPath && fileName === filterPath) {
            const span = document.createElement('span');
            span.className = 'highlight';
            span.textContent = fileName;
            f.appendChild(span);
          } else {
            f.textContent = fileName;
          }
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

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.type = 'button';
        removeBtn.title = 'Remover entrada';
        removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"></path></svg>';
        removeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          vscode.postMessage({ command: 'removeHistory', path: entry.path });
        });
        card.appendChild(removeBtn);
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
