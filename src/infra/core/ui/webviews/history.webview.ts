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
    .date-sep { margin: 18px 0 6px; text-align: left; color: var(--vscode-descriptionForeground); font-size: 13px; font-weight: 400; }
    .card { padding: 12px 48px 12px 12px; border: 1px solid var(--vscode-panel-border); border-radius: 8px; background: color-mix(in srgb, var(--vscode-editor-background) 55%, transparent); cursor: pointer; text-align: left; position: relative; }
    .card:hover { background: var(--vscode-list-hoverBackground); }
    .card-title { font-weight: 600; }
    .card-meta { margin-top: 4px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.45; }
    .summary { margin-top: 8px; color: var(--vscode-descriptionForeground); font-size: 12px; line-height: 1.4; opacity: 0.9; display: -webkit-box; overflow: hidden; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
    .empty { padding: 18px 0; color: var(--vscode-descriptionForeground); }
    .search { width: 100%; margin-top: 12px; padding: 7px 8px; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; }
    .search:focus { outline: 1px solid var(--vscode-focusBorder); }
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
    <input id="search" class="search" type="text" placeholder="Pesquisar pelo contexto da consulta..." aria-label="Pesquisar consultas salvas" />
    <div class="list" id="list"></div>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const history = ${historyJson};
    const filterPath = ${filterPathJson};
    const list = document.getElementById('list');
    const searchInput = document.getElementById('search');

    function normalizeText(value) {
      return (value || '')
        .toString()
        .normalize('NFD')
        .replace(/[\\u0300-\\u036f]/g, '')
        .toLowerCase();
    }

    function getFilteredHistory() {
      const term = normalizeText(searchInput.value).trim();
      if (!term) {
        return history;
      }
      return history.filter(entry => normalizeText(entry.summary).includes(term));
    }

    searchInput.addEventListener('input', render);

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

      const filtered = getFilteredHistory();
      if (!filtered.length) {
        list.innerHTML = '<div class="empty">Nenhuma consulta encontrada para o texto pesquisado.</div>';
        return;
      }

      let prevDate = null;
      for (let i = 0; i < filtered.length; i++) {
        const entry = filtered[i];
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
        const baseName = ((entry.path || '').split('/').pop() || '').replace(/\\.md$/i, '');
        const indexMatch = baseName.match(/_(\\d+)$/);
        const displayIndex = indexMatch ? String(parseInt(indexMatch[1], 10)) : String(filtered.length - i);
        const savedName = baseName || entry.title || 'Consulta sem título';
        title.textContent = displayIndex + ') ' + savedName;

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        meta.textContent = formatDate(entry.createdAt) + ' · ' + (entry.modelName || 'Modelo não identificado') + ' · ' + (entry.totalTokens || 0) + ' tokens · ' + entry.kind;

        const summary = document.createElement('div');
        summary.className = 'summary';
        const fallbackFile = entry.files && entry.files.length ? entry.files[0] : entry.path;
        const summaryText = entry.summary || entry.title || fallbackFile || 'Sem contexto registrado.';
        summary.textContent = summaryText;
        summary.title = summaryText;

        card.appendChild(title);
        card.appendChild(meta);
        card.appendChild(summary);

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
