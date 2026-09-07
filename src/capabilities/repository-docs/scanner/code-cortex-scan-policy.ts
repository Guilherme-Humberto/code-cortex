// Política de varredura compartilhada entre o scanner da extensão (vscode.workspace.fs)
// e o CLI de pre-commit (node:fs), para evitar divergência entre os dois.

export const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'out',
  'coverage',
  '.next',
  'build',
  '.vscode',
  'code-cortex'
]);

export const ALLOWED_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.java',
  '.py',
  '.go',
  '.rb',
  '.php',
  '.cs',
  '.kt',
  '.swift',
  '.c',
  '.cpp',
  '.h',
  '.hpp'
];

export const MAX_FILE_BYTES = 1 * 1024 * 1024;

export function hasAllowedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some(extension => lower.endsWith(extension));
}
