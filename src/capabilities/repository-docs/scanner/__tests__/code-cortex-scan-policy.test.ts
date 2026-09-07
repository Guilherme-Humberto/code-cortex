import { hasAllowedExtension } from '../code-cortex-scan-policy';

describe('code-cortex-scan-policy', () => {
  it.each(['file.ts', 'file.TSX', 'script.py', 'Main.java', 'lib.CPP'])(
    'accepts allowed extension for %s',
    fileName => {
      expect(hasAllowedExtension(fileName)).toBe(true);
    }
  );

  it.each(['README.md', 'image.png', 'data.json', 'no-extension'])(
    'rejects disallowed extension for %s',
    fileName => {
      expect(hasAllowedExtension(fileName)).toBe(false);
    }
  );
});
