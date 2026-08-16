import * as mammoth from 'mammoth';

import {
  isDocxKnowledgeFile,
  prepareKnowledgeFileForStorage,
  toKnowledgeStoragePath
} from '../knowledge-file.util';

jest.mock('mammoth', () => ({
  extractRawText: jest.fn()
}));

describe('knowledge-file.util', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('detects docx files and derives a safe storage path', () => {
    expect(isDocxKnowledgeFile('docs/manual.docx')).toBe(true);
    expect(isDocxKnowledgeFile('docs/manual.md')).toBe(false);
    expect(toKnowledgeStoragePath('docs/manual.docx')).toBe(
      'docs/manual.docx.md'
    );
  });

  it('returns the original bytes for non-docx files', async () => {
    const data = new TextEncoder().encode('plain text');

    await expect(
      prepareKnowledgeFileForStorage('docs/readme.md', data)
    ).resolves.toEqual({
      outputPath: 'docs/readme.md',
      content: data
    });
  });

  it('extracts docx text before storing it', async () => {
    (mammoth.extractRawText as jest.Mock).mockResolvedValue({
      value: 'Word content'
    });

    const result = await prepareKnowledgeFileForStorage(
      'docs/manual.docx',
      new Uint8Array([1, 2, 3])
    );

    expect(mammoth.extractRawText).toHaveBeenCalled();
    expect(result.outputPath).toBe('docs/manual.docx.md');
    expect(new TextDecoder().decode(result.content)).toBe('Word content');
  });
});
