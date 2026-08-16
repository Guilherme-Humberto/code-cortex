import * as vscode from 'vscode';

import { createNonce, serializeWebviewJson } from './webview-utils';

export function buildImpactAnalysisWebviewHtml(
  _webview: vscode.Webview,
  markdown: string,
  totalTokens: number,
  modelName: string,
  files: readonly string[]
): string {
  const nonce = createNonce();
  const markdownJson = serializeWebviewJson(markdown);
  const modelJson = serializeWebviewJson(modelName);
  const filesJson = serializeWebviewJson(files);

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Análise de Impacto</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 13px; }
    .topbar { display: grid; grid-template-columns: 36px minmax(0, 1fr) 28px 28px; align-items: center; gap: 8px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .back { width: 36px; min-height: 36px; padding: 3px; background: transparent; color: var(--vscode-textLink-foreground); border: 1px solid var(--vscode-panel-border); font-size: 18px; }
    .back:hover { background: var(--vscode-list-hoverBackground); }
    .title-group { min-width: 0; }
    .title { overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .model { overflow: hidden; margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .copy-button, .save-button { width: 28px; min-height: 28px; padding: 0; background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); }
    .copy-button:hover, .save-button:hover { color: var(--vscode-foreground); background: var(--vscode-toolbar-hoverBackground); }
    .content { max-width: 860px; padding: 22px 4px 36px; line-height: 1.55; }
    .content h1, .content h2, .content h3 { margin: 22px 0 8px; line-height: 1.25; font-weight: 600; }
    .content h1 { margin-top: 0; font-size: 20px; }
    .content h2 { font-size: 17px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; }
    .content h3 { font-size: 14px; }
    .content p { margin: 8px 0; }
    .content ul, .content ol { padding-left: 22px; }
    .content li { margin: 4px 0; }
    .content code { padding: 1px 4px; border-radius: 3px; background: var(--vscode-textCodeBlock-background); font-family: var(--vscode-editor-font-family); }
    .content pre { overflow: auto; padding: 12px; border-radius: 5px; background: var(--vscode-textCodeBlock-background); }
    .content pre code { padding: 0; background: transparent; }
    .content blockquote { margin: 10px 0; padding-left: 12px; border-left: 3px solid var(--vscode-textLink-foreground); color: var(--vscode-descriptionForeground); }
  </style>
</head>
<body>
  <header class="topbar">
    <button id="back" class="back" aria-label="Voltar" title="Voltar">←</button>
    <div class="title-group">
      <div class="title">Análise de impacto</div>
      <div id="model" class="model"></div>
    </div>
    <button id="copy" class="copy-button" aria-label="Copiar resultado" title="Copiar resultado">⧉</button>
    <button id="save" class="save-button" aria-label="Salvar no histórico" title="Salvar no histórico">⇩</button>
  </header>
  <main id="content" class="content" aria-live="polite"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const markdown = ${markdownJson};
    const files = ${filesJson};
    document.getElementById('model').textContent = ${modelJson} + ' | ' + ${totalTokens.toLocaleString('pt-BR')} + ' tokens';
    document.getElementById('model').title = ${modelJson};
    document.getElementById('back').addEventListener('click', () => vscode.postMessage({ command: 'back' }));

    // hide copy/save when there is no valid result (empty or an error message)
    const normalized = (markdown || '').toString().trim();
    const isError = !normalized || /^##\s*Falha/i.test(normalized) || /Nenhum modelo disponível/i.test(normalized);
    if (isError) {
      document.getElementById('copy').style.display = 'none';
      document.getElementById('save').style.display = 'none';
    } else {
      document.getElementById('copy').addEventListener('click', () => vscode.postMessage({ command: 'copyResult', content: markdown }));
      document.getElementById('save').addEventListener('click', () => vscode.postMessage({ command: 'saveResult', content: markdown, modelName: ${modelJson}, totalTokens: ${totalTokens}, files }));
    }

    function escapeHtml(value) {
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function inline(value) {
      return escapeHtml(value)
        .replace(new RegExp(String.fromCharCode(96) + '([^' + String.fromCharCode(96) + ']+)' + String.fromCharCode(96), 'g'), '<code>$1</code>')
        .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<strong>$1</strong>')
        .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
        .replace(/_([^_]+)_/g, '<em>$1</em>');
    }

    function render(markdownText) {
      const lines = markdownText.replace(/\\r\\n/g, '\\n').split('\\n');
      const blocks = [];
      let index = 0;
      while (index < lines.length) {
        const line = lines[index];
        if (!line.trim()) { index++; continue; }
        if (new RegExp('^\\\\s*' + String.fromCharCode(96).repeat(3)).test(line)) {
          const code = [];
          index++;
          while (index < lines.length && !new RegExp('^\\\\s*' + String.fromCharCode(96).repeat(3)).test(lines[index])) code.push(lines[index++]);
          index++;
          blocks.push('<pre><code>' + escapeHtml(code.join('\\n')) + '</code></pre>');
          continue;
        }
        const heading = line.match(/^\\s*(#{1,6})\\s+(.+)$/);
        if (heading) { const level = heading[1].length; blocks.push('<h' + level + '>' + inline(heading[2]) + '</h' + level + '>'); index++; continue; }
        if (/^\\s*[-*+]\\s+/.test(line)) {
          const items = [];
          while (index < lines.length && /^\\s*[-*+]\\s+/.test(lines[index])) items.push(lines[index++].replace(/^\\s*[-*+]\\s+/, ''));
          blocks.push('<ul>' + items.map(item => '<li>' + inline(item) + '</li>').join('') + '</ul>');
          continue;
        }
        if (/^\\s*\\d+\\.\\s+/.test(line)) {
          const items = [];
          while (index < lines.length && /^\\s*\\d+\\.\\s+/.test(lines[index])) items.push(lines[index++].replace(/^\\s*\\d+\\.\\s+/, ''));
          blocks.push('<ol>' + items.map(item => '<li>' + inline(item) + '</li>').join('') + '</ol>');
          continue;
        }
        if (/^>\\s?/.test(line)) { blocks.push('<blockquote>' + inline(line.replace(/^>\\s?/, '')) + '</blockquote>'); index++; continue; }
        const paragraph = [line];
        index++;
        while (index < lines.length && lines[index].trim() && !/^\\s*#/.test(lines[index]) && !/^\\s*[-*+]\\s+/.test(lines[index])) paragraph.push(lines[index++]);
        blocks.push('<p>' + inline(paragraph.join(' ')) + '</p>');
      }
      return blocks.join('\\n');
    }

    document.getElementById('content').innerHTML = render(markdown);
  </script>
</body>
</html>`;
}
