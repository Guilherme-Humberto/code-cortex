import * as vscode from 'vscode';

import { SELECTED_MODEL_KEY, SELECTED_PROVIDER_KEY } from '../constants';

const SYNC_MODE_KEY = 'code-cortex.syncMode';
const REPO_URL_KEY = 'code-cortex.repoUrl';
const LOCAL_PATH_KEY = 'code-cortex.localPath';
const PRODUCT_KEY = 'code-cortex.product';
const PROJECT_KEY = 'code-cortex.project';
const GITHUB_TOKEN_KEY = 'code-cortex.githubToken';

export type SyncMode = 'github' | 'sharepoint' | 'local';

export interface ImpactSettings {
  syncMode: SyncMode;
  repoUrl: string;
  localPath: string;
  product: string;
  project: string;
  selectedModel: string;
  selectedProvider?: string;
}

export interface SaveImpactSettingsInput {
  syncMode?: string;
  repoUrl?: string;
  localPath?: string;
  product?: string;
  project?: string;
  selectedModel?: string;
  selectedProvider?: string;
}

export async function loadImpactSettings(
  context: vscode.ExtensionContext
): Promise<ImpactSettings> {
  return {
    syncMode: (context.workspaceState.get<string>(SYNC_MODE_KEY) ||
      'github') as SyncMode,
    repoUrl: context.workspaceState.get<string>(REPO_URL_KEY) || '',
    localPath: context.workspaceState.get<string>(LOCAL_PATH_KEY) || '',
    product: context.workspaceState.get<string>(PRODUCT_KEY) || '',
    project: context.workspaceState.get<string>(PROJECT_KEY) || '',
    selectedModel: context.workspaceState.get<string>(SELECTED_MODEL_KEY) || '',
    selectedProvider:
      context.workspaceState.get<string>(SELECTED_PROVIDER_KEY) || 'copilot'
  };
}

export async function saveImpactSettings(
  context: vscode.ExtensionContext,
  input: SaveImpactSettingsInput
): Promise<void> {
  await context.workspaceState.update(
    SYNC_MODE_KEY,
    input.syncMode || 'github'
  );
  await context.workspaceState.update(REPO_URL_KEY, input.repoUrl || '');
  await context.workspaceState.update(LOCAL_PATH_KEY, input.localPath || '');
  await context.workspaceState.update(PRODUCT_KEY, input.product || '');
  await context.workspaceState.update(PROJECT_KEY, input.project || '');
  if (input.selectedProvider) {
    await context.workspaceState.update(
      SELECTED_PROVIDER_KEY,
      input.selectedProvider
    );
  }

  if (input.selectedModel) {
    await context.workspaceState.update(
      SELECTED_MODEL_KEY,
      input.selectedModel
    );
  }
}

export async function saveSelectedModel(
  context: vscode.ExtensionContext,
  modelId?: string
): Promise<void> {
  await context.workspaceState.update(SELECTED_MODEL_KEY, modelId || undefined);
}

export function getSelectedModel(
  context: vscode.ExtensionContext
): string | undefined {
  return context.workspaceState.get<string>(SELECTED_MODEL_KEY);
}

export async function saveLocalPath(
  context: vscode.ExtensionContext,
  localPath: string
): Promise<void> {
  await context.workspaceState.update(LOCAL_PATH_KEY, localPath || '');
}

export async function saveGithubToken(
  context: vscode.ExtensionContext,
  token?: string
): Promise<void> {
  if (token) {
    await context.secrets.store(GITHUB_TOKEN_KEY, token);
    return;
  }
  await context.secrets.delete(GITHUB_TOKEN_KEY);
}

export async function getGithubToken(
  context: vscode.ExtensionContext
): Promise<string | undefined> {
  return context.secrets.get(GITHUB_TOKEN_KEY);
}
