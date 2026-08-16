import * as path from 'node:path';

export const KNOWLEDGE_SYNC_FILE_LIMITS = {
  maxFileBytes: 2 * 1024 * 1024,
  maxTotalBytes: 50 * 1024 * 1024
} as const;

const ALLOWED_EXTENSIONS = new Set(['.md', '.txt', '.json', '.csv', '.docx']);

export function isAllowedKnowledgeFile(filePath: string): boolean {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

export function isLikelyBinaryContent(data: Uint8Array): boolean {
  if (data.length === 0) {
    return false;
  }

  const sampleLength = Math.min(data.length, 4096);
  let suspiciousBytes = 0;

  for (let index = 0; index < sampleLength; index++) {
    const byte = data[index]!;

    if (byte === 0) {
      return true;
    }

    if (byte < 7 || (byte > 13 && byte < 32)) {
      suspiciousBytes++;
    }
  }

  return suspiciousBytes / sampleLength > 0.1;
}
