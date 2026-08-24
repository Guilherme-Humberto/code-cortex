import * as vscode from 'vscode';

import { SELECTED_PROVIDER_KEY } from '../../constants';
import { estimateTokenCount } from '../../utils/token-budget.util';
import { buildImpactPrompt, ImpactPromptInput } from './impact-prompt';

export type ImpactAnalysisInput = ImpactPromptInput;

export interface ImpactAnalysisResult {
  readonly markdown: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
  readonly modelName: string;
}

export async function runImpactAnalysis(
  context: vscode.ExtensionContext | undefined,
  input: ImpactAnalysisInput,
  token: vscode.CancellationToken,
  modelId?: string
): Promise<ImpactAnalysisResult> {
  const model = await selectModel(context, modelId);
  const prompt = buildImpactPrompt(input);
  const response = await model.sendRequest(
    [vscode.LanguageModelChatMessage.User(prompt)],
    {},
    token
  );

  let answer = '';
  for await (const fragment of response.text) {
    answer += fragment;
  }

  const markdown = answer.trim();
  const promptTokens = estimateTokenCount(prompt);
  const completionTokens = estimateTokenCount(markdown);

  return {
    markdown,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    modelName: model.name
  };
}

export function estimateImpactPromptTokens(input: ImpactAnalysisInput): number {
  return estimateTokenCount(buildImpactPrompt(input));
}

async function selectModel(
  context?: vscode.ExtensionContext,
  modelId?: string
): Promise<vscode.LanguageModelChat> {
  const provider =
    context?.workspaceState?.get<string>(SELECTED_PROVIDER_KEY) || 'copilot';

  let [model] = await vscode.lm.selectChatModels({
    vendor: provider,
    ...(modelId ? { id: modelId } : {})
  });

  if (!model && modelId) {
    [model] = await vscode.lm.selectChatModels({ vendor: provider });
    if (model) {
      vscode.window.showWarningMessage(
        'O modelo salvo não está mais disponível para o provider selecionado. Usando outro modelo disponível — revise a seleção nas configurações.'
      );
    }
  }

  if (!model) {
    throw new Error('Nenhum modelo disponível para o provider configurado.');
  }

  return model;
}
