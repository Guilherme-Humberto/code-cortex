import * as vscode from 'vscode';

import { getGithubToken } from '../settings/impact-settings.service';
import { syncFromGithubRepository } from './providers/github-sync.provider';
import {
  pickLocalFolderPath,
  syncFromLocalFolder
} from './providers/local-folder-sync.provider';
import { syncFromSharepointSimulation } from './providers/sharepoint-sync.provider';
import { SyncKnowledgePayload } from './sync.types';

export async function executeKnowledgeSync(
  context: vscode.ExtensionContext,
  payload: SyncKnowledgePayload
): Promise<void> {
  const mode = payload.mode || 'sharepoint';

  if (mode === 'sharepoint') {
    await syncFromSharepointSimulation(payload.product, payload.project);
    return;
  }

  if (mode === 'github') {
    const token = await getGithubToken(context);
    await syncFromGithubRepository(payload.repoUrl, token);
    return;
  }

  if (mode === 'local') {
    await syncFromLocalFolder(payload.localPath);
  }
}

export async function pickLocalFolder(): Promise<string> {
  return pickLocalFolderPath();
}
