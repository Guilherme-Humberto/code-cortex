import * as vscode from 'vscode';

import { ImpactViewProvider } from '../../ui/impact-view-provider';
import { collectSelectedFileContext } from '../../context/selected-file-context';
import {
  getActiveEditorUri,
  getPathFromCommandArgument,
  mergePaths,
  toUris
} from '../../context/file-selection';
import { runImpactAnalysis } from './impact-analysis.service';
import { listHistoryEntries } from '../../history/history.service';
import { findMarkdownDocuments } from '@/capabilities/knowledge/commands/knowledge-context';
import {
  cancelOngoingRequest,
  clearOngoingRequest,
  setOngoingRequest
} from '../../utils/ongoing-request.util';
import {
  IMPACT_STATE_KEY,
  LAST_CHANGE_CONTEXT_KEY,
  MEMORY_PATH,
  SELECTED_MODEL_KEY
} from '../../constants';

export function registerImpactCommands(ctx: vscode.ExtensionContext): void {
  registerAddCommand(ctx);
  registerRemoveCommand(ctx);
  registerSelectFilesCommand(ctx);
  registerAnalysisCommand(ctx);
  registerCancelAnalysisCommand(ctx);
  registerShowHistoryForFileCommand(ctx);
  registerOpenFullHistoryCommand(ctx);
  registerActiveEditorListener(ctx);
}

function registerCancelAnalysisCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'codeCortex.cancelImpactAnalysis',
      async () => {
        if (!cancelOngoingRequest()) {
          return;
        }
        // sai da tela de loading imediatamente, sem depender do provider respeitar o token
        await ImpactViewProvider.current?.refresh();
      }
    )
  );
}

function registerOpenFullHistoryCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('codeCortex.openFullHistory', async () => {
      await vscode.commands.executeCommand(
        'workbench.view.extension.code-cortex'
      );
      ImpactViewProvider.current?.showFullHistory();
    })
  );
}

function registerShowHistoryForFileCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'codeCortex.showHistoryForFile',
      async (arg?: unknown) => {
        const workspace = vscode.workspace.workspaceFolders?.[0];
        if (!workspace) {
          vscode.window.showWarningMessage(
            'Abra uma pasta/workspace primeiro.'
          );
          return;
        }

        let relPath = '';
        if (arg instanceof vscode.Uri) {
          relPath = vscode.workspace.asRelativePath(arg);
        } else if (typeof arg === 'string' && arg.length) {
          relPath = arg;
        } else {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showInformationMessage('Nenhum arquivo ativo.');
            return;
          }
          relPath = vscode.workspace.asRelativePath(editor.document.uri);
        }

        const all = await listHistoryEntries(ctx);
        const filtered = all.filter(
          entry =>
            Array.isArray(entry.files) && entry.files.indexOf(relPath) !== -1
        );

        if (!filtered.length) {
          vscode.window.showInformationMessage(
            'Nenhuma entrada de histórico encontrada para: ' + relPath
          );
          return;
        }

        await vscode.commands.executeCommand(
          'workbench.view.extension.code-cortex'
        );
        ImpactViewProvider.current?.showHistoryForFile(relPath, filtered);
      }
    )
  );
}

function registerActiveEditorListener(ctx: vscode.ExtensionContext): void {
  const status = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  status.text = '$(history) CodeCortex: Histórico de consultas do arquivo';
  status.tooltip = 'Ver histórico deste arquivo';
  status.command = 'codeCortex.showHistoryForFile';
  ctx.subscriptions.push(status);

  const refresh = async (editor?: vscode.TextEditor | undefined) => {
    try {
      const ed = editor ?? vscode.window.activeTextEditor;
      if (!ed || !ed.document) {
        status.hide();
        return;
      }
      const relPath = vscode.workspace.asRelativePath(ed.document.uri);
      const entries = await listHistoryEntries(ctx);
      const has = entries.some(
        e => Array.isArray(e.files) && e.files.indexOf(relPath) !== -1
      );
      if (has) {
        status.show();
      } else {
        status.hide();
      }
    } catch {
      // ignore
      status.hide();
    }
  };

  ctx.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async editor => {
      await refresh(editor);
    })
  );

  // initial check
  void refresh(vscode.window.activeTextEditor);
}

function registerAddCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'codeCortex.addToImpact',
      async (...args: unknown[]) => {
        const selectedUris = args.flatMap(toUris);
        const uris = selectedUris.length ? selectedUris : getActiveEditorUri();

        if (uris.length === 0) {
          vscode.window.showInformationMessage('Nenhum recurso selecionado.');
          return;
        }

        if (!vscode.workspace.workspaceFolders?.length) {
          vscode.window.showWarningMessage(
            'Abra uma pasta/workspace antes de adicionar arquivos.'
          );
          return;
        }

        const updated = mergePaths(
          getSelectedPaths(ctx),
          uris.map(uri => vscode.workspace.asRelativePath(uri))
        );
        await saveSelectedPaths(ctx, updated.paths);
        ImpactViewProvider.current?.refresh();
        vscode.window.showInformationMessage(
          `Adicionados ${updated.added} arquivo(s) à seleção de impacto.`
        );
      }
    )
  );
}

function registerRemoveCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'codeCortex.removeFromImpact',
      async (itemOrPath: unknown) => {
        const pathToRemove = getPathFromCommandArgument(itemOrPath);
        if (!pathToRemove) {
          return;
        }

        const paths = getSelectedPaths(ctx).filter(
          path => path !== pathToRemove
        );
        await saveSelectedPaths(ctx, paths);
        ImpactViewProvider.current?.refresh();
        vscode.window.showInformationMessage(
          `Removido ${pathToRemove} da seleção de impacto.`
        );
      }
    )
  );
}

function registerSelectFilesCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand(
      'codeCortex.selectImpactFiles',
      async () => {
        const uris = await vscode.workspace.findFiles(
          '**/*',
          '**/node_modules/**',
          1000
        );
        const picks = await vscode.window.showQuickPick(
          uris.map(uri => ({
            label: vscode.workspace.asRelativePath(uri),
            uri
          })),
          {
            canPickMany: true,
            placeHolder:
              'Selecione arquivos para adicionar à análise de impacto'
          }
        );

        if (!picks?.length) {
          return;
        }

        const updated = mergePaths(
          getSelectedPaths(ctx),
          picks.map(pick => pick.label)
        );
        await saveSelectedPaths(ctx, updated.paths);
        ImpactViewProvider.current?.refresh();
        vscode.window.showInformationMessage(
          `Adicionados ${updated.added} arquivo(s) à seleção de impacto.`
        );
      }
    )
  );
}

interface ImpactAnalysisCommandOptions {
  readonly changeContext?: string;
  readonly isReanalysis?: boolean;
}

export function shouldAutoSaveImpactAnalysis(markdown: string): boolean {
  const normalizedLines = markdown
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/^#+\s*/, '')
        .replace(/^[-*]\s*/, '')
        .replace(/[*_`]/g, '')
        .trim()
        .toLowerCase()
    )
    .filter(Boolean);

  const resultadoIndex = normalizedLines.findIndex(line =>
    line.startsWith('resultado')
  );
  const candidates =
    resultadoIndex >= 0
      ? normalizedLines.slice(resultadoIndex + 1, resultadoIndex + 4)
      : normalizedLines;

  return candidates.some(
    line => line === 'com impacto' || line.startsWith('saida b')
  );
}

// Reanálises nunca são salvas automaticamente — apenas a análise original.
export function shouldSaveImpactAnalysisResult(
  markdown: string,
  isReanalysis: boolean
): boolean {
  return !isReanalysis && shouldAutoSaveImpactAnalysis(markdown);
}

function registerAnalysisCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('codeCortex.startImpactAnalysis', options =>
      executeImpactAnalysis(
        ctx,
        options as ImpactAnalysisCommandOptions | undefined
      )
    )
  );
}

async function executeImpactAnalysis(
  ctx: vscode.ExtensionContext,
  options: ImpactAnalysisCommandOptions = {}
): Promise<void> {
  const paths = getSelectedPaths(ctx);
  if (paths.length === 0) {
    vscode.window.showWarningMessage(
      'Nenhum arquivo selecionado para análise. Adicione arquivos pelo Explorer.'
    );
    return;
  }

  const changeContext = (options.changeContext || '').trim();
  if (!changeContext) {
    vscode.window.showWarningMessage(
      'Informe o contexto da alteração antes de executar a análise de impacto.'
    );
    return;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showWarningMessage('Nenhum workspace encontrado.');
    return;
  }

  await ctx.workspaceState.update(LAST_CHANGE_CONTEXT_KEY, changeContext);

  const tokenSource = new vscode.CancellationTokenSource();

  try {
    ImpactViewProvider.current?.showLoading(
      'Lendo os arquivos e preparando a análise de impacto...'
    );
    const modelId = ctx.workspaceState.get<string>(SELECTED_MODEL_KEY);
    setOngoingRequest(tokenSource);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Análise de Impacto',
        cancellable: true
      },
      async (progress, progressToken) => {
        progressToken.onCancellationRequested(() => tokenSource.cancel());
        // garante que o fluxo termine ao cancelar mesmo se o provider ignorar o token
        const cancellation = new Promise<never>((_, reject) => {
          tokenSource.token.onCancellationRequested(() =>
            reject(new vscode.CancellationError())
          );
        });
        progress.report({ message: 'Lendo contexto essencial...' });
        const files = await collectSelectedFileContext(workspace, paths);
        if (files.length === 0) {
          throw new Error('Nenhum arquivo legível foi encontrado.');
        }

        progress.report({ message: 'Consultando a base de conhecimento...' });
        const knowledgeFolder = vscode.Uri.joinPath(
          workspace.uri,
          MEMORY_PATH,
          'knowledge'
        );
        const knowledgeDocs = await findMarkdownDocuments(knowledgeFolder);
        if (knowledgeDocs.length === 0) {
          ImpactViewProvider.current?.showAnalysis(
            '## Análise de Impacto indisponível\n\nNenhuma documentação foi encontrada em `code-cortex/knowledge`.\n\nAdicióne arquivos Markdown à base de conhecimento para que o modelo possa comparar as alterações com as regras documentadas.',
            0
          );
          return;
        }

        progress.report({ message: 'Consultando o modelo...' });
        try {
          const result = await Promise.race([
            runImpactAnalysis(
              ctx,
              { files, knowledgeDocs, changeContext },
              tokenSource.token,
              modelId
            ),
            cancellation
          ]);
          if (tokenSource.token.isCancellationRequested) {
            return;
          }
          const markdown =
            result.markdown || 'O modelo não retornou uma análise.';
          const shouldSave = shouldSaveImpactAnalysisResult(
            markdown,
            options.isReanalysis === true
          );
          ImpactViewProvider.current?.showAnalysis(
            markdown,
            result.totalTokens,
            result.modelName,
            paths,
            shouldSave
              ? {
                  kind: 'impact-analysis',
                  title: `Análise de impacto (${paths.length} arquivo(s))`,
                  summary: changeContext
                }
              : undefined
          );
        } finally {
          clearOngoingRequest(tokenSource);
          tokenSource.dispose();
        }
      }
    );
  } catch (error) {
    // se o usuário cancelou, qualquer erro subsequente (ex.: fetch abortado
    // pelo provider, como o "before fetch request" do NVIDIA NIM) é tratado
    // como cancelamento, não como falha
    if (
      tokenSource.token.isCancellationRequested ||
      error instanceof vscode.CancellationError
    ) {
      vscode.window.showInformationMessage('Análise de impacto cancelada.');
      await ImpactViewProvider.current?.refresh();
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    vscode.window.showErrorMessage(`Falha na análise de impacto: ${message}`);
    ImpactViewProvider.current?.showAnalysis(
      `## Falha na análise\n\n${message}`,
      0
    );
    return;
  }

  vscode.window.showInformationMessage(
    `Análise concluída para ${paths.length} arquivo(s).`
  );
}

function getSelectedPaths(ctx: vscode.ExtensionContext): string[] {
  return ctx.workspaceState.get<string[]>(IMPACT_STATE_KEY, []);
}

function saveSelectedPaths(
  ctx: vscode.ExtensionContext,
  paths: readonly string[]
): Thenable<void> {
  return ctx.workspaceState.update(IMPACT_STATE_KEY, [...paths]);
}
