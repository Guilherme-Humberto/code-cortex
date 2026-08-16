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
  a: vscode.ExtensionContext | ImpactAnalysisInput,
  b: ImpactAnalysisInput | vscode.CancellationToken,
  c?: vscode.CancellationToken | string,
  d?: string
): Promise<ImpactAnalysisResult> {
  // normalize arguments for backward compatibility
  let context: vscode.ExtensionContext | undefined;
  let input: ImpactAnalysisInput;
  let token: vscode.CancellationToken;
  let modelId: string | undefined;

  if (isExtensionContext(a)) {
    context = a as vscode.ExtensionContext;
    input = b as ImpactAnalysisInput;
    token = c as vscode.CancellationToken;
    modelId = d;
  } else {
    context = undefined;
    input = a as ImpactAnalysisInput;
    token = b as vscode.CancellationToken;
    modelId = c as string | undefined;
  }

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

function isExtensionContext(value: any): value is vscode.ExtensionContext {
  return value && typeof value === 'object' && 'workspaceState' in value;
}

async function selectModel(
  context?: vscode.ExtensionContext,
  modelId?: string
): Promise<vscode.LanguageModelChat> {
  const provider =
    (context &&
      context.workspaceState &&
      context.workspaceState.get<string>('knowledge.selectedProviderId')) ||
    'copilot';

  let [model] = await vscode.lm.selectChatModels({
    vendor: provider,
    ...(modelId ? { id: modelId } : {})
  });

  if (!model && modelId) {
    [model] = await vscode.lm.selectChatModels({ vendor: provider });
  }

  if (!model) {
    throw new Error('Nenhum modelo disponível para o provider configurado.');
  }

  return model;
}
