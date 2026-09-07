// Geração de Markdown compartilhada entre o writer da extensão e o CLI de
// pre-commit, para garantir que ambos produzam exatamente o mesmo conteúdo.

import { CodeCortexBlock } from '../parser/code-cortex-block-parser';

export interface RepositoryDocsBlock extends CodeCortexBlock {
  readonly sourceFile: string;
}

export const GENERATED_AT_LINE_PATTERN = /^generatedAt:.*$/m;

export function buildMarkdown(
  block: RepositoryDocsBlock,
  generatedAt: string
): string {
  const lines = [
    '---',
    `title: ${escapeFrontmatterValue(block.title)}`,
    ...(block.description
      ? [`description: ${escapeFrontmatterValue(block.description)}`]
      : []),
    `sourceFile: ${block.sourceFile}`,
    'links:',
    ...block.links.map(link => `  - ${link}`),
    `generatedAt: ${generatedAt}`,
    '---',
    '',
    `# ${block.title}`,
    ''
  ];

  if (block.description) {
    lines.push(block.description, '');
  }

  lines.push(block.content || '_Sem conteúdo descrito._');

  return lines.join('\n');
}

/** Remove a linha `generatedAt` para permitir comparar conteúdo ignorando o timestamp. */
export function stripGeneratedAt(markdown: string): string {
  return markdown.replace(GENERATED_AT_LINE_PATTERN, 'generatedAt: <ignored>');
}

export function createUniqueSlug(
  title: string,
  used: Map<string, number>
): string {
  const base = slugify(title);
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

export function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'documento';
}

export function escapeFrontmatterValue(value: string): string {
  return value.replace(/\n/g, ' ').trim();
}
