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

const IMPACT_STATE_KEY = 'impact.selection';
const SELECTED_MODEL_KEY = 'knowledge.selectedModelId';

export function registerImpactCommands(ctx: vscode.ExtensionContext): void {
  registerAddCommand(ctx);
  registerRemoveCommand(ctx);
  registerSelectFilesCommand(ctx);
  registerAnalysisCommand(ctx);
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

function registerAnalysisCommand(ctx: vscode.ExtensionContext): void {
  ctx.subscriptions.push(
    vscode.commands.registerCommand('codeCortex.startImpactAnalysis', () =>
      executeImpactAnalysis(ctx)
    )
  );
}

async function executeImpactAnalysis(
  ctx: vscode.ExtensionContext
): Promise<void> {
  const paths = getSelectedPaths(ctx);
  if (paths.length === 0) {
    vscode.window.showWarningMessage(
      'Nenhum arquivo selecionado para análise. Adicione arquivos pelo Explorer.'
    );
    return;
  }

  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (!workspace) {
    vscode.window.showWarningMessage('Nenhum workspace encontrado.');
    return;
  }

  try {
    ImpactViewProvider.current?.showLoading(
      'Lendo os arquivos e preparando a análise de impacto...'
    );
    const modelId = ctx.workspaceState.get<string>(SELECTED_MODEL_KEY);

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: 'Análise de Impacto',
        cancellable: false
      },
      async progress => {
        progress.report({ message: 'Lendo contexto essencial...' });
        const files = await collectSelectedFileContext(workspace, paths);
        if (files.length === 0) {
          throw new Error('Nenhum arquivo legível foi encontrado.');
        }

        progress.report({ message: 'Consultando o Copilot...' });
        const tokenSource = new vscode.CancellationTokenSource();
        try {
          const result = await runImpactAnalysis(
            {
              objective:
                'Identificar impactos técnicos e pontos de validação entre os arquivos selecionados.',
              files
            },
            tokenSource.token,
            modelId
          );
          ImpactViewProvider.current?.showAnalysis(
            result.markdown || 'O modelo não retornou uma análise.',
            result.totalTokens,
            result.modelName
          );
        } finally {
          tokenSource.dispose();
        }
      }
    );
  } catch (error) {
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
