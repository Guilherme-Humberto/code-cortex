import * as vscode from 'vscode';

import {
  getGithubToken,
  getSelectedModel,
  loadImpactSettings,
  saveGithubToken,
  saveImpactSettings,
  saveLocalPath,
  saveSelectedModel
} from '../settings/impact-settings.service';
import {
  executeKnowledgeSync,
  pickLocalFolder
} from '../sync/knowledge-sync.service';
import { SyncKnowledgePayload } from '../sync/sync.types';
import {
  clearHistoryEntries,
  listHistoryEntries,
  saveHistoryEntry,
  removeHistoryEntry,
  HistoryEntry
} from '../history/history.service';
import { buildImpactAnalysisWebviewHtml } from './webviews/impact-analysis.webview';
import { buildImpactLoadingWebviewHtml } from './webviews/impact-loading.webview';
import { buildImpactMainWebviewHtml } from './webviews/impact-main.webview';
import { buildHistoryWebviewHtml } from './webviews/history.webview';
import { buildImpactSettingsWebviewHtml } from './webviews/impact-settings.webview';
import { IMPACT_STATE_KEY, LAST_CHANGE_CONTEXT_KEY } from '../constants';

type ScreenMode = 'main' | 'history' | 'analysis' | 'loading' | 'settings';

interface HistorySaveRequest {
  readonly kind: 'impact-analysis' | 'knowledge-search' | 'manual';
  readonly title: string;
  readonly summary?: string;
}

// Tipo das mensagens recebidas da webview — evita uso de `any` no handler
interface WebviewMessage {
  command: string;
  path?: string;
  content?: string;
  token?: string;
  files?: string[];
  question?: string;
  changeContext?: string;
  modelId?: string;
  modelName?: string;
  totalTokens?: number;
  provider?: string;
  syncMode?: string;
  repoUrl?: string;
  localPath?: string;
  product?: string;
  project?: string;
  selectedModel?: string;
  selectedProvider?: string;
}

export class ImpactViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'code-cortex-view';
  public static current?: ImpactViewProvider;

  private readonly extensionUri: vscode.Uri;
  private view?: vscode.WebviewView;
  private currentScreen: ScreenMode = 'main';
  private lastHistorySave?: {
    readonly markdown: string;
    readonly metadata: HistorySaveRequest & {
      readonly modelName: string;
      readonly totalTokens: number;
      readonly files: readonly string[];
    };
  };

  constructor(private readonly context: vscode.ExtensionContext) {
    this.extensionUri = context.extensionUri;
  }

  public async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;
    ImpactViewProvider.current = this;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri]
    };

    await this.renderMain();

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this.handleMessage(message);
    });
  }

  public async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }
    await this.renderCurrentScreen();
  }

  public showAnalysis(
    markdown: string,
    totalTokens: number,
    modelName = 'Modelo não identificado',
    files: readonly string[] = [],
    historySave?: HistorySaveRequest
  ): void {
    if (!this.view) {
      return;
    }

    this.currentScreen = 'analysis';
    this.lastHistorySave = historySave
      ? {
          markdown,
          metadata: {
            ...historySave,
            modelName,
            totalTokens,
            files: [...files]
          }
        }
      : undefined;

    this.view.webview.html = buildImpactAnalysisWebviewHtml(
      this.view.webview,
      markdown,
      totalTokens,
      modelName,
      files,
      historySave?.kind,
      historySave?.title
    );

    if (this.lastHistorySave) {
      void this.persistHistoryEntry(
        this.lastHistorySave.markdown,
        this.lastHistorySave.metadata
      );
    }
  }

  public showLoading(message: string): void {
    if (!this.view) {
      return;
    }

    this.currentScreen = 'loading';

    this.view.webview.html = buildImpactLoadingWebviewHtml(
      this.view.webview,
      message
    );
  }

  private async handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.command) {
      case 'open':
        await this.openWorkspaceFile(message.path);
        return;
      case 'remove':
        await this.removeFileFromSelection(message.path);
        return;
      case 'reload':
        await this.reloadSelection();
        return;
      case 'analyze':
        await vscode.commands.executeCommand('codeCortex.startImpactAnalysis', {
          changeContext: message.changeContext
        });
        return;
      case 'back':
        await this.renderMain();
        return;
      case 'cancelAnalysis':
        await vscode.commands.executeCommand('codeCortex.cancelImpactAnalysis');
        return;
      case 'history':
        await this.renderHistory();
        return;
      case 'historyBack':
        await this.renderMain();
        return;
      case 'clearHistory':
        await this.handleClearHistory();
        return;
      case 'copyResult':
        await vscode.env.clipboard.writeText(message.content || '');
        vscode.window.showInformationMessage('Resultado copiado.');
        return;
      case 'reanalyze': {
        const changeContext = this.context.workspaceState.get<string>(
          LAST_CHANGE_CONTEXT_KEY
        );
        if (!changeContext) {
          vscode.window.showWarningMessage(
            'Nenhuma análise anterior encontrada para refazer.'
          );
          return;
        }
        await vscode.commands.executeCommand('codeCortex.startImpactAnalysis', {
          changeContext,
          isReanalysis: true
        });
        return;
      }
      case 'saveResult':
        await this.handleSaveResult(message);
        vscode.window.showInformationMessage('Consulta salva no histórico.');
        return;
      case 'openHistory':
        await this.openWorkspaceFile(message.path);
        return;
      case 'removeHistory':
        await this.handleRemoveHistory(message);
        return;
      case 'searchDocs':
        await this.searchDocumentationByFile(message.files ?? []);
        return;
      case 'searchFilesDocs':
        await vscode.commands.executeCommand(
          'codeCortex_knowledge_searchFiles',
          message.question
        );
        return;
      case 'settings':
        await this.renderSettings();
        return;
      case 'saveGithubToken':
        await this.handleSaveGithubToken(message.token);
        return;
      case 'saveSettings':
        await this.handleSaveSettings(message);
        return;
      case 'requestModels':
        await this.handleRequestModels(message);
        return;
      case 'saveModel':
        await saveSelectedModel(this.context, message.modelId);
        return;
      case 'syncKnowledge':
        await executeKnowledgeSync(
          this.context,
          message as SyncKnowledgePayload
        );
        return;
      case 'pickLocalFolder':
        await this.handlePickLocalFolder();
        return;
      default:
        return;
    }
  }

  private async renderMain(): Promise<void> {
    if (!this.view) {
      return;
    }

    this.currentScreen = 'main';
    const files = this.getSelectedFiles();
    const history = await listHistoryEntries(this.context, { limit: 10 });
    this.view.webview.html = buildImpactMainWebviewHtml(
      this.view.webview,
      files,
      history
    );
  }

  private async renderHistory(): Promise<void> {
    if (!this.view) {
      return;
    }

    this.currentScreen = 'history';
    const history = await listHistoryEntries(this.context);
    this.view.webview.html = buildHistoryWebviewHtml(
      this.view.webview,
      history
    );
  }

  private async renderSettings(): Promise<void> {
    if (!this.view) {
      return;
    }

    this.currentScreen = 'settings';

    const settings = await loadImpactSettings(this.context);
    const provider = settings.selectedProvider || 'copilot';
    const models = await vscode.lm.selectChatModels({ vendor: provider });
    const token = await getGithubToken(this.context);
    const tokenSavedNotice = token ? ' (token salvo)' : '';

    this.view.webview.html = buildImpactSettingsWebviewHtml({
      models,
      selectedModelId: getSelectedModel(this.context),
      tokenSavedNotice,
      tokenValue: token || null,
      settings
    });
  }

  public showHistoryForFile(
    filePath: string,
    entries: readonly HistoryEntry[]
  ): void {
    if (!this.view) {
      return;
    }

    this.currentScreen = 'history';
    this.view.webview.html = buildHistoryWebviewHtml(
      this.view.webview,
      entries,
      `Filtrado por: ${filePath}`,
      filePath
    );
  }

  public async showFullHistory(): Promise<void> {
    await this.renderHistory();
  }

  private getSelectedFiles(): string[] {
    return this.context.workspaceState.get<string[]>(IMPACT_STATE_KEY, []);
  }

  private async removeFileFromSelection(path?: string): Promise<void> {
    if (!path) {
      return;
    }

    const updated = this.getSelectedFiles().filter(item => item !== path);
    await this.context.workspaceState.update(IMPACT_STATE_KEY, updated);
    await this.renderMain();
  }

  private async reloadSelection(): Promise<void> {
    await this.context.workspaceState.update(IMPACT_STATE_KEY, []);
    await this.renderMain();
  }

  private async openWorkspaceFile(path?: string): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceFolder || !path) {
      return;
    }

    const target = vscode.Uri.joinPath(workspaceFolder, path);
    await vscode.window.showTextDocument(target);
  }

  private async searchDocumentationByFile(files: string[]): Promise<void> {
    if (!files || files.length === 0) {
      vscode.window.showWarningMessage(
        'Nenhum arquivo selecionado para pesquisa.'
      );
      return;
    }

    const pick = await vscode.window.showQuickPick(files, {
      placeHolder: 'Selecione o arquivo para pesquisar na documentação'
    });

    if (!pick) {
      return;
    }

    await vscode.commands.executeCommand('workbench.action.findInFiles', {
      query: pick,
      triggerSearch: true,
      isRegex: false
    });
  }

  private async handleSaveGithubToken(token?: string): Promise<void> {
    try {
      await saveGithubToken(this.context, token);
      vscode.window.showInformationMessage(
        token ? 'Token GitHub salvo com segurança.' : 'Token GitHub removido.'
      );
    } catch (error) {
      console.error('Failed to store/delete github token', error);
      vscode.window.showErrorMessage('Falha ao salvar token GitHub.');
    }
  }

  private async handleSaveSettings(message: WebviewMessage): Promise<void> {
    try {
      await saveImpactSettings(this.context, {
        syncMode: message.syncMode,
        repoUrl: message.repoUrl,
        localPath: message.localPath,
        product: message.product,
        project: message.project,
        selectedModel: message.selectedModel,
        selectedProvider: message.selectedProvider
      });
      vscode.window.showInformationMessage('Configurações salvas.');
    } catch (error) {
      console.error('Failed to save settings', error);
      vscode.window.showErrorMessage('Falha ao salvar configurações.');
    }
  }

  private async handlePickLocalFolder(): Promise<void> {
    const folder = await pickLocalFolder();

    if (this.view) {
      this.view.webview.postMessage({
        command: 'localFolderSelected',
        path: folder || ''
      });
    }

    if (!folder) {
      return;
    }

    try {
      await saveLocalPath(this.context, folder);
    } catch (error) {
      console.error('Failed to persist localPath', error);
    }
  }

  private async renderCurrentScreen(): Promise<void> {
    switch (this.currentScreen) {
      case 'history':
        await this.renderHistory();
        return;
      case 'settings':
        await this.renderSettings();
        return;
      case 'analysis':
      case 'loading':
      case 'main':
      default:
        await this.renderMain();
    }
  }

  private async handleClearHistory(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      'Apagar todo o histórico de consultas? Esta ação não pode ser desfeita.',
      { modal: true },
      'Apagar'
    );
    if (choice === 'Apagar') {
      await clearHistoryEntries(this.context);
      await this.renderHistory();
    }
  }

  private async handleSaveResult(message: WebviewMessage): Promise<void> {
    await this.persistHistoryEntry(message.content || '', {
      kind: this.lastHistorySave?.metadata.kind || 'manual',
      title: this.lastHistorySave?.metadata.title || 'Consulta manual',
      modelName:
        message.modelName ||
        this.lastHistorySave?.metadata.modelName ||
        'Modelo não identificado',
      totalTokens:
        Number(message.totalTokens) ||
        this.lastHistorySave?.metadata.totalTokens ||
        0,
      files: Array.isArray(message.files)
        ? message.files
        : this.lastHistorySave?.metadata.files || [],
      summary: this.lastHistorySave?.metadata.summary
    });
  }

  private async handleRemoveHistory(message: WebviewMessage): Promise<void> {
    const { path } = message;
    const choice = await vscode.window.showWarningMessage(
      'Remover esta entrada do histórico? Esta ação não pode ser desfeita.',
      { modal: true },
      'Remover'
    );
    if (choice === 'Remover') {
      try {
        if (path) {
          await removeHistoryEntry(this.context, path);
        }
      } catch (error) {
        console.error('Falha ao remover entrada do histórico:', error);
      }
      await this.renderHistory();
    }
  }

  private async handleRequestModels(message: WebviewMessage): Promise<void> {
    const provider =
      message.provider ||
      (await loadImpactSettings(this.context)).selectedProvider ||
      'copilot';
    try {
      const models = await vscode.lm.selectChatModels({ vendor: provider });
      const sorted = [...(models ?? [])]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(m => ({ id: m.id, name: m.name }));
      this.view?.webview.postMessage({ command: 'models', models: sorted });
    } catch (error) {
      console.error('Falha ao buscar modelos para o provider', provider, error);
      this.view?.webview.postMessage({ command: 'models', models: [] });
    }
  }

  private async persistHistoryEntry(
    markdown: string,
    metadata: HistorySaveRequest & {
      readonly modelName: string;
      readonly totalTokens: number;
      readonly files: readonly string[];
      readonly summary?: string;
    }
  ): Promise<void> {
    try {
      await saveHistoryEntry(this.context, markdown, metadata);
    } catch (error) {
      console.error('Failed to save history entry', error);
      vscode.window.showWarningMessage(
        'A análise foi concluída, mas não foi possível salvá-la no histórico.'
      );
    }
  }
}
