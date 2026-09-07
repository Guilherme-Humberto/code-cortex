export interface CodeCortexBlock {
  readonly title: string;
  readonly description?: string;
  readonly links: readonly string[];
  readonly content: string;
}

const BLOCK_PATTERN = /@code_cortex\s+open([\s\S]*?)@code_cortex\s+close/gi;
const TAG_LINE_PATTERN = /^@(title|description|links|content)\b\s*(.*)$/i;
// remove indentação e o prefixo "*" típico de comentários JSDoc de cada linha
const COMMENT_PREFIX_PATTERN = /^[ \t]*\*?[ \t]?/;

/**
 * Extrai blocos `@code_cortex open ... close` de um arquivo, independente
 * da linguagem/estilo de comentário utilizado ao redor.
 */
export function extractCodeCortexBlocks(
  fileContent: string
): CodeCortexBlock[] {
  const blocks: CodeCortexBlock[] = [];
  let match: RegExpExecArray | null;

  BLOCK_PATTERN.lastIndex = 0;
  while ((match = BLOCK_PATTERN.exec(fileContent)) !== null) {
    const block = parseBlockBody(match[1] ?? '');
    if (block) {
      blocks.push(block);
    }
  }

  return blocks;
}

function parseBlockBody(body: string): CodeCortexBlock | null {
  const lines = body
    .split('\n')
    .map(line => line.replace(COMMENT_PREFIX_PATTERN, ''));
  const tagValues: Record<string, string[]> = {};
  let currentTag: string | null = null;

  for (const line of lines) {
    const tagMatch = line.match(TAG_LINE_PATTERN);
    if (tagMatch) {
      currentTag = tagMatch[1]!.toLowerCase();
      tagValues[currentTag] ??= [];
      const inlineValue = tagMatch[2]?.trim();
      if (inlineValue) {
        tagValues[currentTag]!.push(inlineValue);
      }
      continue;
    }

    if (!currentTag) {
      continue;
    }

    const trimmed = line.trim();
    // preserva linhas em branco apenas dentro de @content, para manter parágrafos
    if (trimmed || currentTag === 'content') {
      tagValues[currentTag]!.push(trimmed);
    }
  }

  const title = (tagValues.title ?? []).join(' ').trim();
  if (!title) {
    return null;
  }

  const description =
    (tagValues.description ?? []).join(' ').trim() || undefined;
  const links = (tagValues.links ?? [])
    .join(' ')
    .split(',')
    .map(link => link.trim())
    .filter(Boolean);
  const content = (tagValues.content ?? []).join('\n').trim();

  return { title, description, links, content };
}
