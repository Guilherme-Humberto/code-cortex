export type KnowledgeSyncMode = 'sharepoint' | 'github' | 'local';

export interface SyncKnowledgePayload {
  mode?: string;
  product?: string;
  project?: string;
  repoUrl?: string;
  localPath?: string;
}
