import { serializeWebviewJson } from '../webview-utils';

describe('webview-utils', () => {
  it('escapes angle brackets in serialized json', () => {
    const json = serializeWebviewJson({ markup: '</script><div>' });

    expect(json).toContain('\\u003c/script>');
    expect(json).not.toContain('</script>');
  });
});
