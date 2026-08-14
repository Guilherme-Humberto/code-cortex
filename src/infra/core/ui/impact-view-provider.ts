import * as vscode from 'vscode';

const IMPACT_STATE_KEY = 'impact.selection';
const SELECTED_MODEL_KEY = 'knowledge.selectedModelId';

export class ImpactViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'code-cortex-view';
  public static current?: ImpactViewProvider;

  private extensionUri: vscode.Uri;
  private _view?: vscode.WebviewView;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    ImpactViewProvider.current = this;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    let files = await this._getFilesList();

    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview,
      files
    );

    webviewView.webview.onDidReceiveMessage(async (message: any) => {
      switch (message.command) {
        case 'open': {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
          if (!workspaceFolder) {
            return;
          }
          const target = vscode.Uri.joinPath(workspaceFolder, message.path);
          await vscode.window.showTextDocument(target);
          return;
        }
        case 'remove': {
          const current: string[] = this.context.workspaceState.get(
            IMPACT_STATE_KEY,
            []
          );
          const updated = current.filter(p => p !== message.path);
          await this.context.workspaceState.update(IMPACT_STATE_KEY, updated);

          // refresh webview content
          files = updated;
          if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(
              this._view.webview,
              files
            );
          }

          return;
        }
        case 'analyze':
          await vscode.commands.executeCommand(
            'codeCortex.startImpactAnalysis'
          );
          return;
        case 'back':
          files = await this._getFilesList();
          if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(
              this._view.webview,
              files
            );
          }
          return;
        case 'copyResult':
          await vscode.env.clipboard.writeText(message.content || '');
          vscode.window.showInformationMessage('Resultado copiado.');
          return;
        case 'searchDocs':
          if (!message.files || message.files.length === 0) {
            vscode.window.showWarningMessage(
              'Nenhum arquivo selecionado para pesquisa.'
            );
            return;
          }

          const pick = await vscode.window.showQuickPick(message.files, {
            placeHolder: 'Selecione o arquivo para pesquisar na documentação'
          });

          if (pick) {
            await vscode.commands.executeCommand(
              'workbench.action.findInFiles',
              {
                query: pick,
                triggerSearch: true,
                isRegex: false
              }
            );
          }

          return;
        case 'searchFilesDocs':
          await vscode.commands.executeCommand(
            'codeCortex_knowledge_searchFiles',
            message.question
          );
          return;
        case 'settings':
          this._view!.webview.html = await this._getSettingsHtml(
            this._view!.webview
          );
          return;
        case 'saveModel':
          await this.context.workspaceState.update(
            SELECTED_MODEL_KEY,
            message.modelId || undefined
          );
          return;
        case 'syncKnowledge':
          await this._syncKnowledge(message.product, message.project);
          return;
      }
    });
  }

  public async refresh() {
    if (!this._view) {
      return;
    }
    const files = await this._getFilesList();
    this._view.webview.html = this._getHtmlForWebview(
      this._view.webview,
      files
    );
  }

  public showAnalysis(
    markdown: string,
    totalTokens: number,
    modelName = 'Modelo não identificado'
  ): void {
    if (!this._view) {
      return;
    }
    this._view.webview.html = this._getAnalysisHtml(
      this._view.webview,
      markdown,
      totalTokens,
      modelName
    );
  }

  public showLoading(message: string): void {
    if (!this._view) {
      return;
    }
    this._view.webview.html = this._getLoadingHtml(this._view.webview, message);
  }

  private async _getFilesList(): Promise<string[]> {
    try {
      const list: string[] = this.context.workspaceState.get(
        IMPACT_STATE_KEY,
        []
      );
      return list || [];
    } catch (err) {
      console.error('Failed to read impact files', err);
      return [];
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview, files: string[]): string {
    const nonce = getNonce();
    const filesJson = JSON.stringify(files);

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
    body { margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 13px; }
    .header { margin: 2px 0 16px; }
    .title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
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
  </style>
</head>
<body>
  <header class="header">
    <p class="eyebrow">Workspace intelligence</p>
    <div class="title-row"><h1>CodeCortex</h1><button id="settings" class="icon-button" title="Configurações" aria-label="Configurações">⚙</button></div>
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

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    let files = ${filesJson};

    const filesContainer = document.getElementById('files');
    const fileCount = document.getElementById('file-count');

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

    document.getElementById('analyze').addEventListener('click', () => {
      vscode.postMessage({ command: 'analyze', files });
    });

    document.getElementById('settings').addEventListener('click', () => {
      vscode.postMessage({ command: 'settings' });
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
  </script>
</body>
</html>`;
  }

  private _getAnalysisHtml(
    webview: vscode.Webview,
    markdown: string,
    totalTokens: number,
    modelName: string
  ): string {
    const nonce = getNonce();
    const markdownJson = JSON.stringify(markdown).replace(/</g, '\\u003c');
    const modelJson = JSON.stringify(modelName).replace(/</g, '\\u003c');

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
    .topbar { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    .back { width: 36px; min-height: 36px; padding: 3px; background: transparent; color: var(--vscode-textLink-foreground); border: 1px solid var(--vscode-panel-border); font-size: 18px; }
    .back:hover { background: var(--vscode-list-hoverBackground); }
    .title-group { min-width: 0; }
    .title { overflow: hidden; font-size: 14px; font-weight: 600; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .model { overflow: hidden; margin-top: 2px; color: var(--vscode-descriptionForeground); font-size: 11px; line-height: 1.25; text-overflow: ellipsis; white-space: nowrap; }
    .copy-button { width: 28px; min-height: 28px; padding: 0; background: transparent; color: var(--vscode-descriptionForeground); border: 1px solid var(--vscode-panel-border); }
    .copy-button:hover { color: var(--vscode-foreground); background: var(--vscode-toolbar-hoverBackground); }
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
  </header>
  <main id="content" class="content" aria-live="polite"></main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const markdown = ${markdownJson};
    document.getElementById('model').textContent = ${modelJson} + ' | ' + ${totalTokens.toLocaleString('pt-BR')} + ' tokens';
    document.getElementById('model').title = ${modelJson};
    document.getElementById('back').addEventListener('click', () => vscode.postMessage({ command: 'back' }));
    document.getElementById('copy').addEventListener('click', () => vscode.postMessage({ command: 'copyResult', content: markdown }));

    function escapeHtml(value) {
      return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
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

  private _getLoadingHtml(webview: vscode.Webview, message: string): string {
    const nonce = getNonce();
    const messageJson = JSON.stringify(message).replace(/</g, '\\u003c');

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
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <main class="loading" aria-live="polite">
    <div class="spinner" aria-hidden="true"></div>
    <p id="message"></p>
  </main>
  <script nonce="${nonce}">
    document.getElementById('message').textContent = ${messageJson};
  </script>
</body>
</html>`;
  }

  private async _syncKnowledge(
    product: string | undefined,
    project: string | undefined
  ): Promise<void> {
    const normalizedProduct = product?.trim();
    const normalizedProject = project?.trim();
    if (!normalizedProduct || !normalizedProject) {
      vscode.window.showWarningMessage('Informe o produto e o projeto.');
      return;
    }

    this.showLoading('Sincronizando documentação do SharePoint...');
    await new Promise(resolve => setTimeout(resolve, 350));
    this.showAnalysis(
      `## Sincronização não configurada\n\nProduto: **${normalizedProduct}**\n\nProjeto: **${normalizedProject}**\n\nA conexão remota do SharePoint ainda precisa de uma URL, biblioteca e autenticação. O comando antigo era apenas um placeholder e foi removido.`,
      0,
      'Sincronização SharePoint'
    );
  }

  private async _getSettingsHtml(webview: vscode.Webview): Promise<string> {
    const nonce = getNonce();
    const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
    const selectedModelId =
      this.context.workspaceState.get<string>(SELECTED_MODEL_KEY);
    const modelOptions = [...models]
      .sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR', {
          sensitivity: 'base'
        })
      )
      .map(model => {
        const label = model.name;
        const isAutomaticModel = label.trim().toLowerCase() === 'auto';
        const selected =
          model.id === selectedModelId || (!selectedModelId && isAutomaticModel)
            ? ' selected'
            : '';
        return `<option value="${escapeHtmlAttribute(model.id)}"${selected}>${escapeHtmlAttribute(label)}</option>`;
      })
      .join('');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Configurações</title>
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 12px; color: var(--vscode-foreground); background: var(--vscode-sideBar-background); font-family: var(--vscode-font-family); font-size: 13px; }
    .topbar { display: flex; align-items: center; gap: 10px; padding-bottom: 12px; border-bottom: 1px solid var(--vscode-panel-border); }
    button, input { font: inherit; }
    button { min-height: 30px; padding: 6px 10px; border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); cursor: pointer; }
    button:hover { background: var(--vscode-button-hoverBackground); }
    .back { background: transparent; color: var(--vscode-textLink-foreground); border-color: var(--vscode-panel-border); }
    main { max-width: 500px; padding: 24px 4px; }
    h1 { margin: 0; font-size: 18px; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; }
    label { display: block; margin: 16px 0 6px; font-weight: 600; }
    input { width: 100%; padding: 8px; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
    input:focus { outline: 1px solid var(--vscode-focusBorder); }
    select { width: 100%; padding: 8px; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); border-radius: 4px; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); font: inherit; }
    #sync { margin-top: 18px; }
  </style>
</head>
<body>
  <header class="topbar"><button id="back" class="back">← Voltar</button><strong>Configurações</strong></header>
  <main>
    <h1>Sincronizar conhecimento</h1>
    <p>Informe o contexto para buscar a documentação remota do SharePoint.</p>
    <label for="product">Produto</label>
    <input id="product" type="text" placeholder="Ex.: Portal de Vendas" />
    <label for="project">Projeto</label>
    <input id="project" type="text" placeholder="Ex.: Checkout" />
    <label for="model">Modelo para consultas</label>
    <select id="model">
      ${modelOptions || '<option value="" disabled>Nenhum modelo Copilot disponível</option>'}
    </select>
    <button id="sync">Sincronizar</button>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('back').addEventListener('click', () => vscode.postMessage({ command: 'back' }));
    document.getElementById('model').addEventListener('change', () => vscode.postMessage({ command: 'saveModel', modelId: document.getElementById('model').value }));
    document.getElementById('sync').addEventListener('click', () => vscode.postMessage({ command: 'syncKnowledge', product: document.getElementById('product').value, project: document.getElementById('project').value }));
  </script>
</body>
</html>`;
  }
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
