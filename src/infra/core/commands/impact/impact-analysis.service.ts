import * as vscode from 'vscode';

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
  input: ImpactAnalysisInput,
  token: vscode.CancellationToken,
  modelId?: string
): Promise<ImpactAnalysisResult> {
  const model = await selectModel(modelId);
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
  modelId?: string
): Promise<vscode.LanguageModelChat> {
  let [model] = await vscode.lm.selectChatModels({
    vendor: 'copilot',
    ...(modelId ? { id: modelId } : {})
  });

  if (!model && modelId) {
    [model] = await vscode.lm.selectChatModels({ vendor: 'copilot' });
  }

  if (!model) {
    throw new Error('Nenhum modelo do GitHub Copilot está disponível.');
  }

  return model;
}
