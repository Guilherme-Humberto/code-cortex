import { redactSensitiveContent } from '../redact-sensitive.util';

describe('redact-sensitive.util', () => {
  it('redacts pem blocks and certificate content', () => {
    const redacted = redactSensitiveContent(
      'before\n-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\nafter'
    );

    expect(redacted).toContain(
      '[Conteúdo sensível omitido por conter segredo ou certificado.]'
    );
    expect(redacted).not.toContain('PRIVATE KEY');
    expect(redacted).not.toContain('secret');
  });

  it('redacts common secret assignments and token-like values', () => {
    const redacted = redactSensitiveContent(
      'API_KEY=abc123\nexport SECRET_TOKEN="ghp_abcdefghijklmnopqrstuvwxyz1234"\naws=AKIA1234567890ABCDEF'
    );

    expect(redacted).toContain('API_KEY=[REDACTED]');
    expect(redacted).toContain('SECRET_TOKEN=[REDACTED]');
    expect(redacted).toContain('aws=[REDACTED]');
  });

  it('redacts sensitive file contents based on file path', () => {
    const redacted = redactSensitiveContent(
      'plain text secret',
      '/workspace/.env'
    );

    expect(redacted).toBe(
      '[Conteúdo sensível omitido por conter segredo ou certificado.]'
    );
  });
});
