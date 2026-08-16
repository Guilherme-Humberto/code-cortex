import * as mammoth from 'mammoth';

const DOCX_EXTENSION = '.docx';

export interface PreparedKnowledgeFile {
  readonly outputPath: string;
  readonly content: Uint8Array;
}

export function isDocxKnowledgeFile(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(DOCX_EXTENSION);
}

export function toKnowledgeStoragePath(filePath: string): string {
  return filePath.replace(/\.docx$/i, '.docx.md');
}

export async function prepareKnowledgeFileForStorage(
  filePath: string,
  data: Uint8Array
): Promise<PreparedKnowledgeFile> {
  if (!isDocxKnowledgeFile(filePath)) {
    return {
      outputPath: filePath,
      content: data
    };
  }

  const extracted = await mammoth.extractRawText({
    buffer: Buffer.from(data)
  });

  return {
    outputPath: toKnowledgeStoragePath(filePath),
    content: Buffer.from(extracted.value, 'utf8')
  };
}
