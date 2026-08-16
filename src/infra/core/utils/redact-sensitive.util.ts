import * as path from 'node:path';

const SENSITIVE_PATH_PATTERN =
  /(?:^|[\\/])(\.env(?:\.[^/\\]+)?|[^/\\]+\.(?:pem|key|crt|cer|p12|pfx|der|asc|gpg|pgp))$/i;
const PEM_BLOCK_PATTERN = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/gi;
const CERTIFICATE_BLOCK_PATTERN =
  /-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/gi;
const SENSITIVE_KEY_PATTERN =
  /^(\s*(?:export\s+)?(?:[A-Za-z0-9_.-]*?(?:API[_-]?KEY|ACCESS[_-]?TOKEN|REFRESH[_-]?TOKEN|SECRET|PASSWORD|PASS|PRIVATE[_-]?KEY|CLIENT[_-]?SECRET|CLIENT[_-]?TOKEN|CERT(?:IFICATE)?|SSH[_-]?KEY)[A-Za-z0-9_.-]*)\s*=\s*)(.+)$/gim;
const GITHUB_TOKEN_PATTERN = /gh[opsu]_[A-Za-z0-9_]{20,}/g;
const AWS_ACCESS_KEY_PATTERN = /AKIA[0-9A-Z]{16}/g;

const SENSITIVE_FILE_MESSAGE =
  '[Conteúdo sensível omitido por conter segredo ou certificado.]';
const REDACTED_VALUE = '[REDACTED]';

export function redactSensitiveContent(
  content: string,
  sourcePath?: string
): string {
  if (!content) {
    return content;
  }

  if (sourcePath && SENSITIVE_PATH_PATTERN.test(normalizePath(sourcePath))) {
    return SENSITIVE_FILE_MESSAGE;
  }

  return content
    .replace(PEM_BLOCK_PATTERN, SENSITIVE_FILE_MESSAGE)
    .replace(CERTIFICATE_BLOCK_PATTERN, SENSITIVE_FILE_MESSAGE)
    .replace(
      SENSITIVE_KEY_PATTERN,
      (_, prefix: string) => `${prefix}${REDACTED_VALUE}`
    )
    .replace(GITHUB_TOKEN_PATTERN, REDACTED_VALUE)
    .replace(AWS_ACCESS_KEY_PATTERN, REDACTED_VALUE);
}

function normalizePath(value: string): string {
  return value.split(path.sep).join('/');
}
