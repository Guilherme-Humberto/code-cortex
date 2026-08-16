import * as vscode from 'vscode';

import { HistoryEntry } from '../../history/history.service';
import { createNonce, serializeWebviewJson } from './webview-utils';

export function buildImpactMainWebviewHtml(
  webview: vscode.Webview,
  files: string[],
  history: readonly HistoryEntry[]
): string {
  const nonce = createNonce();
  const filesJson = serializeWebviewJson(files);
  const historyJson = serializeWebviewJson(history);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CodeCortex</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    /* hide scrollbar but keep scroll functional */
    html, body { scrollbar-width: none; -ms-overflow-style: none; }
    body::-webkit-scrollbar { width: 0; height: 0; }
    body { margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 13px; }
    .header { margin: 2px 0 16px; }
    .title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .brand { display: flex; min-width: 0; align-items: center; gap: 7px; }
    .header-actions { display: flex; align-items: center; gap: 6px; }
    .eyebrow { margin: 0 0 4px; color: var(--vscode-textLink-foreground); font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; }
    h1 { margin: 0; font-size: 20px; font-weight: 600; letter-spacing: 0; }
    .subtitle { margin: 5px 0 0; color: var(--vscode-descriptionForeground); line-height: 1.45; }
    .accordion { margin: 8px 0; border: 1px solid var(--vscode-panel-border); border-radius: 6px; background: color-mix(in srgb, var(--vscode-editor-background) 45%, transparent); overflow: hidden; }
    .accordion summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 12px; cursor: pointer; list-style: none; font-weight: 600; }
    .accordion summary::-webkit-details-marker { display: none; }
    .accordion summary::after { content: '+'; color: var(--vscode-descriptionForeground); font-size: 16px; font-weight: 400; }
    .accordion[open] summary::after { content: '−'; }
    .accordion summary:hover { background: var(--vscode-list-hoverBackground); }
    .accordion-content { padding: 0 12px 12px; }
    .overview { display: grid; grid-template-columns: 1fr auto; gap: 10px; align-items: center; }
    .stat { color: var(--vscode-descriptionForeground); }
    .stat strong { display: block; color: var(--vscode-foreground); font-size: 24px; line-height: 1; }
    .actions { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 10px; }
    .question { display: flex; gap: 7px; margin-top: 10px; }
    .question input { min-width: 0; flex: 1; padding: 7px 8px; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); font: inherit; }
    .question input:focus { outline: 1px solid var(--vscode-focusBorder); }
    button { min-height: 30px; padding: 6px 10px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; font: inherit; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .icon-button { width: 30px; min-height: 30px; padding: 0; background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); }
    .icon-button:hover { color: var(--vscode-foreground); background: var(--vscode-toolbar-hoverBackground); }
    .secondary { background: var(--vscode-secondaryButton-background); color: var(--vscode-secondaryButton-foreground); border-color: color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); }
    .files { max-height: 280px; overflow: auto; }
    .file-row { display: flex; align-items: center; gap: 8px; padding: 7px 6px; border-top: 1px solid var(--vscode-panel-border); }
    .file-row:first-child { border-top: 0; }
    .file-link { min-width: 0; flex: 1; overflow: hidden; color: var(--vscode-textLink-foreground); text-decoration: none; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    .file-link:hover { text-decoration: underline; }
    .remove-btn { min-width: 26px; padding: 2px 6px; background: transparent; color: var(--vscode-descriptionForeground); border: 0; }
    .remove-btn:hover { color: var(--vscode-errorForeground); background: var(--vscode-toolbar-hoverBackground); }
    .empty { padding: 8px 0 2px; color: var(--vscode-descriptionForeground); line-height: 1.45; }
    .history { min-width: 0; max-height: 220px; overflow: auto; }
    .history-row { display: block; width: 100%; min-width: 0; min-height: 0; overflow: hidden; padding: 7px 6px; border: 0; border-top: 1px solid var(--vscode-panel-border); border-radius: 0; background: transparent; color: var(--vscode-textLink-foreground); cursor: pointer; font: inherit; text-align: left; text-overflow: ellipsis; white-space: nowrap; }
    .history-row:first-child { border-top: 0; }
    .history-row:hover { background: var(--vscode-list-hoverBackground); }
    .history .files > div { margin-bottom: 4px; }
  </style>
</head>
<body>
  <header class="header">
    <p class="eyebrow">Workspace intelligence</p>
    <div class="title-row">
      <div class="brand"><h1>CodeCortex</h1></div>
      <div class="header-actions">
        <button id="reload" class="icon-button" title="Limpar arquivos em foco e atualizar histórico" aria-label="Limpar arquivos em foco e atualizar histórico">↻</button>
        <button id="settings" class="icon-button" title="Configurações" aria-label="Configurações">⚙</button>
      </div>
    </div>
    <p class="subtitle">Organize contexto, arquivos e conhecimento do projeto.</p>
  </header>

  <details class="accordion" open>
    <summary>Visão geral</summary>
    <div class="accordion-content overview">
      <div class="stat"><strong id="file-count">0</strong>arquivos em foco</div>
      <button id="analyze">Executar análise</button>
    </div>
  </details>

  <details class="accordion" open>
    <summary>Arquivos selecionados</summary>
    <div class="accordion-content">
      <div class="files" id="files"></div>
    </div>
  </details>

  <details class="accordion">
    <summary>Conhecimento e ferramentas</summary>
    <div class="accordion-content">
      <p class="subtitle"><strong>Arquivos em foco</strong> para análise funcional de um fluxo ou módulo.</p>
      <div class="actions">
        <button class="secondary quick-question" data-question="Explique o que este código faz funcionalmente.">O que este código faz?</button>
        <button class="secondary quick-question" data-question="Quais impactos funcionais existem neste fluxo ou módulo?">Quais impactos existem?</button>
      </div>
      <div class="question">
        <input id="question" type="text" placeholder="Pergunte sobre os arquivos em foco" aria-label="Pergunta sobre os arquivos em foco" />
        <button id="ask">Enviar</button>
      </div>
    </div>
  </details>

  <details class="accordion" open>
    <summary>Últimas 10 consultas</summary>
    <div class="accordion-content">
      <div style="margin:6px 0 10px;"><a id="open-full-history" href="#">Ver histórico completo</a></div>
      <div class="history" id="history"></div>
    </div>
  </details>

  <footer style="margin-top:34px;border-top:1px solid var(--vscode-panel-border);padding-top:12px;color:var(--vscode-descriptionForeground);font-size:12px;">
    <strong>Dicas de segurança e uso</strong>
    <ul style="margin:8px 0 0;padding-left:18px;line-height:1.35;">
      <li>Não inclua chaves, tokens ou certificados nas consultas.</li>
      <li>Revise o histórico e remova entradas sensíveis quando necessário.</li>
      <li>Use <em>Ver histórico completo</em> para exportar ou limpar registros.</li>
    </ul>
  </footer>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let files = ${filesJson};
    const history = ${historyJson};

    const filesContainer = document.getElementById('files');
    const fileCount = document.getElementById('file-count');
    const historyContainer = document.getElementById('history');

    function render() {
      filesContainer.innerHTML = '';
      fileCount.textContent = files.length;
      if (!files || files.length === 0) {
        filesContainer.innerHTML = '<div class="empty">Nenhum arquivo em foco. Use o Explorer ou comandos do CodeCortex para adicionar arquivos ao workspace.</div>';
        return;
      }

      for (const f of files) {
        const row = document.createElement('div');
        row.className = 'file-row';

        const link = document.createElement('a');
        link.className = 'file-link';
        link.textContent = f;
        link.onclick = () => vscode.postMessage({ command: 'open', path: f });

        const remove = document.createElement('button');
        remove.className = 'remove-btn';
        remove.textContent = 'Remover';
        remove.title = 'Remover';
        remove.onclick = () => vscode.postMessage({ command: 'remove', path: f });

        row.appendChild(link);
        row.appendChild(remove);
        filesContainer.appendChild(row);
      }
    }

    function renderHistory() {
      historyContainer.innerHTML = '';
      if (!history.length) {
        historyContainer.innerHTML = '<div class="empty">Nenhuma consulta salva ainda.</div>';
        return;
      }

      for (let idx = 0; idx < history.length; idx++) {
        const entry = history[idx];
        const row = document.createElement('button');
        row.className = 'history-row';
        const title = document.createElement('div');
        const savedName = (entry.path || '').split('/').pop() || entry.title || entry.path;
        title.textContent = (idx + 1) + ') ' + savedName;
        title.style.fontWeight = '600';
        title.style.whiteSpace = 'nowrap';
        title.style.overflow = 'hidden';
        title.style.textOverflow = 'ellipsis';

        const filesEl = document.createElement('div');
        filesEl.className = 'files';
        filesEl.style.fontSize = '12px';
        filesEl.style.color = 'var(--vscode-descriptionForeground)';
        filesEl.style.marginTop = '6px';
        filesEl.style.display = 'flex';
        filesEl.style.flexDirection = 'column';
        const files = (entry.files && entry.files.length) ? entry.files : [entry.path];
        const maxShow = 3;
        for (let i = 0; i < Math.min(files.length, maxShow); i++) {
          const li = document.createElement('div');
          li.textContent = files[i];
          filesEl.appendChild(li);
        }
        if (files.length > maxShow) {
          const more = document.createElement('div');
          more.textContent = '...';
          filesEl.appendChild(more);
        }

        row.appendChild(title);
        row.appendChild(filesEl);
        row.addEventListener('click', () => vscode.postMessage({ command: 'openHistory', path: entry.path }));
        historyContainer.appendChild(row);
      }
    }

    document.getElementById('analyze').addEventListener('click', () => {
      vscode.postMessage({ command: 'analyze', files });
    });

    document.getElementById('settings').addEventListener('click', () => {
      vscode.postMessage({ command: 'settings' });
    });

    document.getElementById('open-full-history').addEventListener('click', (e) => {
      e.preventDefault();
      vscode.postMessage({ command: 'history' });
    });

    document.getElementById('reload').addEventListener('click', () => {
      vscode.postMessage({ command: 'reload' });
    });

    function askKnowledge(question) {
      const value = question.trim();
      if (!value) return;
      vscode.postMessage({ command: 'searchFilesDocs', question: value });
    }

    document.querySelectorAll('.quick-question').forEach(button => {
      button.addEventListener('click', () => askKnowledge(button.dataset.question || ''));
    });

    document.getElementById('ask').addEventListener('click', () => {
      const input = document.getElementById('question');
      askKnowledge(input.value);
      input.value = '';
    });

    document.getElementById('question').addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('ask').click();
      }
    });

    render();
    renderHistory();
  </script>
</body>
</html>`;
}
