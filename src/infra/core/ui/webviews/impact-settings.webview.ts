import * as vscode from 'vscode';

import { ImpactSettings } from '../../settings/impact-settings.service';
import {
  createNonce,
  escapeHtmlAttribute,
  serializeWebviewJson
} from './webview-utils';

interface BuildImpactSettingsWebviewParams {
  models: readonly vscode.LanguageModelChat[];
  selectedModelId?: string;
  tokenSavedNotice: string;
  tokenValue?: string | null;
  settings: ImpactSettings;
}

export function buildImpactSettingsWebviewHtml(
  params: BuildImpactSettingsWebviewParams
): string {
  const nonce = createNonce();
  const { models, selectedModelId, tokenSavedNotice, tokenValue, settings } =
    params;

  const defaultModelId =
    selectedModelId || (models && models.length ? models[0]!.id : undefined);

  const modelOptions = [...models]
    .sort((left, right) =>
      left.name.localeCompare(right.name, 'pt-BR', {
        sensitivity: 'base'
      })
    )
    .map(model => {
      const label = model.name;
      const isAutomaticModel = label.trim().toLowerCase() === 'auto';
      const selected = model.id === defaultModelId ? ' selected' : '';
      return `<option value="${escapeHtmlAttribute(model.id)}"${selected}>${escapeHtmlAttribute(label)}</option>`;
    })
    .join('');

  const initialConfigJson = serializeWebviewJson(settings);
  const tokenValueJson = JSON.stringify(tokenValue ?? '').replace(
    /</g,
    '\u003c'
  );

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
    h2 { margin: 0; font-size: 18px; line-height: normal; }
    p { color: var(--vscode-descriptionForeground); line-height: 1.5; }
    label { display: block; margin: 16px 0 6px; font-weight: 600; }
    input { width: 100%; max-width: 100%; box-sizing: border-box; padding: 8px; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); border-radius: 4px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); }
    input:focus { outline: 1px solid var(--vscode-focusBorder); }
    select { width: 100%; padding: 8px; border: 1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background)); border-radius: 4px; background: var(--vscode-dropdown-background); color: var(--vscode-dropdown-foreground); font: inherit; }
    #model { margin-bottom: 24px; }
    .thin-sep { border-top: 1px solid var(--vscode-panel-border); margin: 12px 0; }
  </style>
</head>
<body>
  <header class="topbar"><button id="back" class="back">← Voltar</button><strong>Configurações</strong></header>
  <main>
    <div style="padding:8px 0px;color:var(--vscode-descriptionForeground);font-size:12px;">
      <strong>As alterações são salvas automaticamente.</strong> Alterar o modelo ou campos de sincronização salva sem necessidade de confirmação.
    </div>
    <div class="thin-sep"></div>
    <label for="provider">Provedores</label>
    <select id="provider">
      <option value="copilot">GitHub Copilot</option>
      <option value="openai">OpenAI</option>
      <option value="azure">Azure</option>
      <option value="anthropic">Anthropic</option>
      <option value="google">Google</option>
      <option value="nvidia-nim">NVIDIA</option>
    </select>
    <div style="margin-top:6px;color:var(--vscode-descriptionForeground);font-size:12px;">O provider deve estar registrado no host do VS Code para listar modelos (ex.: Copilot, OpenAI provider).</div>
    <label for="model">Modelos</label>
    <select id="model">
      ${modelOptions || '<option value="" disabled>Nenhum modelo Copilot disponível</option>'}
    </select>
    <div class="thin-sep"></div>
    <h2>Sincronizar conhecimento</h2>
    <p>Escolha a fonte de sincronização e informe os dados necessários.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
      <label for="syncMode">Fonte</label>
      <select id="syncMode" style="min-width:200px;">
        <option value="github" selected>Repositório GitHub</option>
        <option value="sharepoint">SharePoint (simulação)</option>
        <option value="local">Diretório Local</option>
      </select>
    </div>

    <div id="sharepointFields" style="margin-top:12px;">
      <label for="product">Produto</label>
      <input id="product" type="text" placeholder="Ex.: Portal de Vendas" />
      <label for="project">Projeto</label>
      <input id="project" type="text" placeholder="Ex.: Checkout" />
    </div>

    <div id="githubFields" style="display:none;margin-top:12px;">
      <label for="githubToken">Token GitHub (opcional)</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="githubToken" type="password" placeholder="Cole um Personal Access Token" style="flex:1;padding:8px;border-radius:4px;border:1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background));background:var(--vscode-input-background);color:var(--vscode-input-foreground);" />
        <button id="removeGithubToken" style="background:transparent;color:var(--vscode-errorForeground);border:1px solid var(--vscode-panel-border);">Remover</button>
      </div>
      <div style="margin-top:6px;margin-bottom:12px;color:var(--vscode-descriptionForeground);font-size:12px;">Use um token para acessar repositórios privados${tokenSavedNotice}.</div>
      <label for="repoUrl">URL do repositório GitHub</label>
      <input id="repoUrl" type="text" placeholder="https://github.com/org/repo" />
    </div>

    <div id="localFields" style="display:none;margin-top:12px;">
      <p class="subtitle">A seleção da pasta abrirá o explorador de arquivos do sistema. O caminho selecionado não substituirá o contexto padrão da extensão.</p>
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="localPath" type="text" placeholder="Nenhuma pasta selecionada" readonly style="flex:1;padding:8px;border-radius:4px;border:1px solid color-mix(in srgb, var(--vscode-foreground) 32%, var(--vscode-sideBar-background));background:var(--vscode-input-background);color:var(--vscode-input-foreground);" />
        <button id="pickFolder">Alterar</button>
      </div>
      <div style="margin-top:8px;color:var(--vscode-descriptionForeground);font-size:12px;">Ao sincronizar, arquivos serão copiados para <strong>code-cortex/knowledge</strong>.</div>
    </div>

    <div style="display:flex;gap:8px;margin-top:12px;">
      <button id="sync">Sincronizar</button>
    </div>
  </main>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const initial = ${initialConfigJson} || {};

    setTimeout(() => {
      try {
        if (initial.syncMode) document.getElementById('syncMode').value = initial.syncMode;
        if (initial.repoUrl) document.getElementById('repoUrl').value = initial.repoUrl;
        if (initial.localPath) document.getElementById('localPath').value = initial.localPath;
        if (initial.product) document.getElementById('product').value = initial.product;
        if (initial.project) document.getElementById('project').value = initial.project;
        if (initial.selectedModel) document.getElementById('model').value = initial.selectedModel;
        // if a token value was provided, populate the input (useful UX despite token being stored securely)
        try { document.getElementById('githubToken').value = ${tokenValueJson} || document.getElementById('githubToken').value; } catch(e) {}
      } catch (e) {}
      updateMode();
      // request models from the extension host in case provider models are available asynchronously
      try {
        vscode.postMessage({ command: 'requestModels', provider: document.getElementById('provider').value });
      } catch (e) {}
    }, 30);

    document.getElementById('back').addEventListener('click', () => vscode.postMessage({ command: 'back' }));
    document.getElementById('model').addEventListener('change', () => {
      const modelId = document.getElementById('model').value;
      vscode.postMessage({ command: 'saveModel', modelId });
      autoSave();
    });

    // initialize provider select from initial settings
    try {
      if (initial.selectedProvider) document.getElementById('provider').value = initial.selectedProvider;
    } catch (e) {}

    document.getElementById('provider').addEventListener('change', () => {
      // ao trocar de provider, o modelo salvo pertence ao provider anterior — limpa para não enviar um id inválido
      try {
        const modelSelect = document.getElementById('model');
        if (modelSelect) {
          modelSelect.innerHTML = '';
        }
        vscode.postMessage({ command: 'saveModel', modelId: '' });
        initial.selectedModel = '';
      } catch (e) {}
      autoSave();
      // request models for the newly selected provider without reloading the webview
      vscode.postMessage({ command: 'requestModels', provider: document.getElementById('provider').value });
    });

    function saveGithubToken() {
      const token = document.getElementById('githubToken').value;
      vscode.postMessage({ command: 'saveGithubToken', token: token || '' });
      if (!token) {
        document.getElementById('githubToken').value = '';
      }
    }

    function removeGithubToken() {
      vscode.postMessage({ command: 'saveGithubToken', token: '' });
      document.getElementById('githubToken').value = '';
    }

    document.getElementById('removeGithubToken').addEventListener('click', removeGithubToken);

    function autoSave() {
      const payload = {
        syncMode: document.getElementById('syncMode').value,
        repoUrl: document.getElementById('repoUrl').value,
        localPath: document.getElementById('localPath').value,
        product: document.getElementById('product').value,
        project: document.getElementById('project').value,
        selectedModel: document.getElementById('model').value,
        selectedProvider: document.getElementById('provider').value
      };
      vscode.postMessage({ command: 'saveSettings', ...payload });
    }

    const syncModeSelect = document.getElementById('syncMode');
    const sharepointFields = document.getElementById('sharepointFields');
    const githubFields = document.getElementById('githubFields');
    const localFields = document.getElementById('localFields');
    const localPathInput = document.getElementById('localPath');

    function updateMode() {
      const mode = (document.getElementById('syncMode') || { value: 'github' }).value;
      sharepointFields.style.display = mode === 'sharepoint' ? 'block' : 'none';
      githubFields.style.display = mode === 'github' ? 'block' : 'none';
      localFields.style.display = mode === 'local' ? 'block' : 'none';
    }
    syncModeSelect.addEventListener('change', () => {
      updateMode();

      // Clear fields that don't apply to the newly selected source
      try {
        const mode = (document.getElementById('syncMode') || { value: 'github' }).value;
        const allowedByMode = {
          github: ['githubToken', 'repoUrl'],
          sharepoint: ['product', 'project'],
          local: ['localPath']
        };
        const allowed = new Set(allowedByMode[mode] || []);
        const all = ['githubToken', 'repoUrl', 'product', 'project', 'localPath'];
        for (const id of all) {
          if (!allowed.has(id)) {
            try {
              const el = document.getElementById(id);
              if (el && 'value' in el) el.value = '';
            } catch (e) {}
          }
        }
      } catch (e) {
        // ignore
      }
    });

    // repository URL will be saved only when user clicks 'Sincronizar'
    const repoUrlEl = document.getElementById('repoUrl');

    document.getElementById('pickFolder').addEventListener('click', () => {
      vscode.postMessage({ command: 'pickLocalFolder' });
      localPathInput.value = 'Aguardando seleção...';
    });
    document.getElementById('sync').addEventListener('click', () => {
      const modeEl = document.getElementById('syncMode');
      const mode = modeEl ? (modeEl.value || 'github') : 'github';
      if (mode === 'sharepoint') {
        vscode.postMessage({ command: 'saveSettings', syncMode: mode, product: document.getElementById('product').value, project: document.getElementById('project').value, selectedModel: document.getElementById('model').value });
        vscode.postMessage({ command: 'syncKnowledge', mode: 'sharepoint', product: document.getElementById('product').value, project: document.getElementById('project').value });
        return;
      }
      if (mode === 'github') {
        // Save token via secure store before syncing
        try {
          const token = document.getElementById('githubToken').value;
          vscode.postMessage({ command: 'saveGithubToken', token: token || '' });
        } catch (e) {}
        vscode.postMessage({ command: 'saveSettings', syncMode: mode, repoUrl: document.getElementById('repoUrl').value, selectedModel: document.getElementById('model').value });
        vscode.postMessage({ command: 'syncKnowledge', mode: 'github', repoUrl: document.getElementById('repoUrl').value });
        return;
      }
      if (mode === 'local') {
        vscode.postMessage({ command: 'saveSettings', syncMode: mode, localPath: document.getElementById('localPath').value, selectedModel: document.getElementById('model').value });
        vscode.postMessage({ command: 'syncKnowledge', mode: 'local', localPath: document.getElementById('localPath').value });
      }
    });

    window.addEventListener('message', event => {
      const msg = event.data || {};
      if (msg.command === 'localFolderSelected') {
        localPathInput.value = msg.path || '';
      }
    });

    // listen for model list updates from extension (also ensure default selection)
    window.addEventListener('message', event => {
      const msg = event.data || {};
      if (msg.command === 'models') {
        const models = Array.isArray(msg.models) ? msg.models : [];
        const modelSelect = document.getElementById('model');
        if (!modelSelect) return;
        modelSelect.innerHTML = '';
        if (models.length === 0) {
          const opt = document.createElement('option');
          opt.value = '';
          opt.disabled = true;
          opt.textContent = 'Nenhum modelo disponível para o provider selecionado';
          modelSelect.appendChild(opt);
          return;
        }

        const initialSelected = initial.selectedModel || '';
        const selectedId = initialSelected || (models[0] && (models[0].id || models[0].name) ) || '';

        for (const m of models) {
          const opt = document.createElement('option');
          const id = m.id || m.name || '';
          opt.value = id;
          opt.textContent = m.name || m.id || String(m);
          if (id === selectedId) opt.selected = true;
          modelSelect.appendChild(opt);
        }

        // if we selected a default because there was no saved selection, persist it
        if (!initial.selectedModel && selectedId) {
          try {
            modelSelect.value = selectedId;
            modelSelect.dispatchEvent(new Event('change'));
          } catch (e) {}
        }
      }
    });

    updateMode();
  </script>
</body>
</html>`;
}
