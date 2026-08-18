import * as vscode from 'vscode';

import { DisposableStore } from '@/infra/core/bootstrap/disposable-store';
import { registerDisposable } from '@/infra/core/utils/register-disposable.utils';
import { IMPACT_STATE_KEY, MEMORY_PATH } from '@/infra/core/constants';
import { ImpactViewProvider } from '@/infra/core/ui/impact-view-provider';
import { estimateTokenCount } from '@/infra/core/utils/token-budget.util';
import { collectSelectedFileContext } from '@/infra/core/context/selected-file-context';
import { findMarkdownDocuments } from './knowledge-context';
import {
  createFilesKnowledgePrompt,
  createKnowledgePrompt
} from './knowledge-prompt';

/**
 * Registra o comando responsável por consultar
 * a Base de Conhecimento Funcional.
 */
export function registerSearchKnowledgeCommand(
  ctx: vscode.ExtensionContext,
  store: DisposableStore
): void {
  const disposable = vscode.commands.registerCommand(
    'codeCortex_knowledge_search',
    async () => {
      const editor = vscode.window.activeTextEditor;

      if (!editor) {
        vscode.window.showWarningMessage(
          'Abra um arquivo e selecione um trecho de código.'
        );
        return;
      }

      const selection = editor.document.getText(editor.selection);
      if (!selection.trim()) {
        vscode.window.showWarningMessage(
          'Selecione um trecho de código para pesquisar.'
        );
        return;
      }

      const workspace = vscode.workspace.workspaceFolders?.[0];
      if (!workspace) {
        vscode.window.showErrorMessage('Nenhum workspace encontrado.');
        return;
      }
      const selectedFile = vscode.workspace.asRelativePath(editor.document.uri);

      await vscode.commands.executeCommand(
        'workbench.view.extension.code-cortex'
      );
      ImpactViewProvider.current?.showLoading(
        'Analisando o código selecionado na Base de Conhecimento...'
      );

      const knowledgeFolder = vscode.Uri.joinPath(
        workspace.uri,
        MEMORY_PATH,
        'knowledge'
      );
      const documents = await findMarkdownDocuments(knowledgeFolder);
      if (documents.length === 0) {
        ImpactViewProvider.current?.showAnalysis(
          '## Nenhuma documentação encontrada\n\nNão há arquivos disponíveis em `code-cortex/knowledge` para realizar esta pesquisa.',
          0
        );
        vscode.window.showInformationMessage(
          `Nenhuma documentação encontrada em ${MEMORY_PATH}/knowledge.`
        );
        return;
      }

      const prompt = createKnowledgePrompt(selection, documents);
      const [model] = await selectConfiguredModel(ctx);
      if (!model) {
        ImpactViewProvider.current?.showAnalysis(
          '## Copilot indisponível\n\nNenhum modelo do GitHub Copilot está disponível para concluir a pesquisa.',
          estimateTokenCount(prompt)
        );
        void vscode.window.showErrorMessage(
          'Nenhum modelo do GitHub Copilot está disponível.'
        );
        return;
      }

      const tokenSource = new vscode.CancellationTokenSource();
      try {
        const response = await model.sendRequest(
          [vscode.LanguageModelChatMessage.User(prompt)],
          {},
          tokenSource.token
        );
        let answer = '';
        for await (const fragment of response.text) {
          answer += fragment;
        }

        ImpactViewProvider.current?.showAnalysis(
          answer || 'O modelo não retornou uma análise.',
          estimateTokenCount(prompt) + estimateTokenCount(answer),
          describeModel(model),
          [selectedFile],
          {
            kind: 'knowledge-search',
            title: `Pesquisa na Base de Conhecimento: ${selectedFile}`
          }
        );
        void vscode.window.showInformationMessage(
          'Consulta à Base de Conhecimento concluída.'
        );
      } finally {
        tokenSource.dispose();
      }
    }
  );

  registerDisposable(ctx, store, disposable);

  const fileSearchDisposable = vscode.commands.registerCommand(
    'codeCortex_knowledge_searchFiles',
    async (question?: string) => {
      const workspace = vscode.workspace.workspaceFolders?.[0];
      const selectedPaths: string[] = ctx.workspaceState.get(
        IMPACT_STATE_KEY,
        []
      );

      if (!workspace || selectedPaths.length === 0) {
        vscode.window.showWarningMessage(
          'Adicione arquivos em foco antes de pesquisar a documentação.'
        );
        return;
      }

      await vscode.commands.executeCommand(
        'workbench.view.extension.code-cortex'
      );
      ImpactViewProvider.current?.showLoading(
        'Analisando os arquivos em foco na Base de Conhecimento...'
      );

      const documents = await findMarkdownDocuments(
        vscode.Uri.joinPath(workspace.uri, MEMORY_PATH, 'knowledge')
      );
      const files = await collectSelectedFileContext(workspace, selectedPaths);

      if (documents.length === 0 || files.length === 0) {
        ImpactViewProvider.current?.showAnalysis(
          '## Contexto insuficiente\n\nÉ necessário ter arquivos em foco e documentação em `code-cortex/knowledge` para realizar esta pesquisa.',
          0
        );
        return;
      }

      const prompt = createFilesKnowledgePrompt(
        files,
        documents,
        question || 'Explique o comportamento funcional dos arquivos em foco.'
      );
      const [model] = await selectConfiguredModel(ctx);
      if (!model) {
        ImpactViewProvider.current?.showAnalysis(
          '## Copilot indisponível\n\nNenhum modelo do GitHub Copilot está disponível para concluir a pesquisa.',
          estimateTokenCount(prompt)
        );
        return;
      }

      const tokenSource = new vscode.CancellationTokenSource();
      try {
        const response = await model.sendRequest(
          [vscode.LanguageModelChatMessage.User(prompt)],
          {},
          tokenSource.token
        );
        let answer = '';
        for await (const fragment of response.text) {
          answer += fragment;
        }

        ImpactViewProvider.current?.showAnalysis(
          answer || 'O modelo não retornou uma análise.',
          estimateTokenCount(prompt) + estimateTokenCount(answer),
          describeModel(model),
          selectedPaths,
          {
            kind: 'knowledge-search',
            title: `Pesquisa com arquivos em foco: ${question || 'sem pergunta'}`
          }
        );
      } finally {
        tokenSource.dispose();
      }
    }
  );

  registerDisposable(ctx, store, fileSearchDisposable);
}

function describeModel(model: vscode.LanguageModelChat): string {
  return model.name;
}

async function selectConfiguredModel(
  ctx: vscode.ExtensionContext
): Promise<vscode.LanguageModelChat[]> {
  const modelId = ctx.workspaceState.get<string>('knowledge.selectedModelId');
  const provider =
    ctx.workspaceState.get<string>('knowledge.selectedProviderId') || 'copilot';
  const models = await vscode.lm.selectChatModels({
    vendor: provider,
    ...(modelId ? { id: modelId } : {})
  });

  return models.length > 0 || !modelId
    ? models
    : vscode.lm.selectChatModels({ vendor: provider });
}
