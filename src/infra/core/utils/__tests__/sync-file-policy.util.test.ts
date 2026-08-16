import {
  isAllowedKnowledgeFile,
  isLikelyBinaryContent
} from '../sync-file-policy.util';

describe('sync-file-policy.util', () => {
  it('allows only whitelisted knowledge file extensions', () => {
    expect(isAllowedKnowledgeFile('docs/readme.md')).toBe(true);
    expect(isAllowedKnowledgeFile('docs/data.json')).toBe(true);
    expect(isAllowedKnowledgeFile('docs/manual.docx')).toBe(true);
    expect(isAllowedKnowledgeFile('docs/image.png')).toBe(false);
  });

  it('detects binary content heuristically', () => {
    expect(isLikelyBinaryContent(new Uint8Array([0, 1, 2, 3]))).toBe(true);
    expect(isLikelyBinaryContent(new TextEncoder().encode('plain text'))).toBe(
      false
    );
  });
});
