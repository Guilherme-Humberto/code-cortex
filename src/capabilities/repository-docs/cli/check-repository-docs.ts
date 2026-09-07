// CLI puro (sem dependência de `vscode`) para validar/gerar a documentação
// derivada de blocos @code_cortex fora do host da extensão (ex: pre-commit).

import * as fs from 'node:fs';
import * as path from 'node:path';

import { extractCodeCortexBlocks } from '../parser/code-cortex-block-parser';
import {
  hasAllowedExtension,
  IGNORED_DIRECTORIES,
  MAX_FILE_BYTES
} from '../scanner/code-cortex-scan-policy';
import {
  buildMarkdown,
  createUniqueSlug,
  RepositoryDocsBlock
} from '../writer/repository-docs-markdown';

const MEMORY_PATH = 'code-cortex';
const DOCUMENTATION_DIRECTORY = 'documentation';
const REPOSITORY_DOCS_DIRECTORY = 'repository';
const FROZEN_TIMESTAMP = '1970-01-01T00:00:00.000Z';

/** Varre `rootDir`, valida os blocos @code_cortex e regenera code-cortex/documentation/repository. */
export async function run(rootDir: string): Promise<number> {
  const blocks = collectBlocks(rootDir);
  const brokenLinks = findBrokenLinks(rootDir, blocks);

  if (brokenLinks.length > 0) {
    console.error('Blocos @code_cortex com @links quebrados:');
    for (const issue of brokenLinks) {
      console.error(
        `  - ${issue.sourceFile} -> ${issue.link} (arquivo não encontrado)`
      );
    }
    return 1;
  }

  const targetDir = path.join(
    rootDir,
    MEMORY_PATH,
    DOCUMENTATION_DIRECTORY,
    REPOSITORY_DOCS_DIRECTORY
  );
  const expected = buildExpectedFiles(blocks);

  writeExpectedFiles(targetDir, expected);
  console.log(
    `Documentação atualizada: ${expected.size} bloco(s) em ${path.relative(rootDir, targetDir)}.`
  );
  return 0;
}

function collectBlocks(rootDir: string): RepositoryDocsBlock[] {
  const results: RepositoryDocsBlock[] = [];
  walk(rootDir, rootDir, results);
  return results;
}

function walk(
  rootDir: string,
  currentDir: string,
  results: RepositoryDocsBlock[]
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      walk(rootDir, fullPath, results);
      continue;
    }

    if (!entry.isFile() || !hasAllowedExtension(entry.name)) {
      continue;
    }

    collectBlocksFromFile(rootDir, fullPath, results);
  }
}

function collectBlocksFromFile(
  rootDir: string,
  filePath: string,
  results: RepositoryDocsBlock[]
): void {
  const stat = fs.statSync(filePath);
  if (stat.size > MAX_FILE_BYTES) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('@code_cortex')) {
    return;
  }

  const sourceFile = path.relative(rootDir, filePath).split(path.sep).join('/');
  for (const block of extractCodeCortexBlocks(content)) {
    results.push({ ...block, sourceFile });
  }
}

interface BrokenLink {
  readonly sourceFile: string;
  readonly link: string;
}

function findBrokenLinks(
  rootDir: string,
  blocks: readonly RepositoryDocsBlock[]
): BrokenLink[] {
  const issues: BrokenLink[] = [];
  for (const block of blocks) {
    for (const link of block.links) {
      if (!fs.existsSync(path.join(rootDir, link))) {
        issues.push({ sourceFile: block.sourceFile, link });
      }
    }
  }
  return issues;
}

function buildExpectedFiles(
  blocks: readonly RepositoryDocsBlock[]
): Map<string, string> {
  const usedSlugs = new Map<string, number>();
  const files = new Map<string, string>();

  for (const block of blocks) {
    const slug = createUniqueSlug(block.title, usedSlugs);
    files.set(`${slug}.md`, buildMarkdown(block, FROZEN_TIMESTAMP));
  }

  return files;
}

function writeExpectedFiles(
  targetDir: string,
  expected: ReadonlyMap<string, string>
): void {
  fs.mkdirSync(targetDir, { recursive: true });

  for (const name of fs.readdirSync(targetDir)) {
    if (name.endsWith('.md')) {
      fs.unlinkSync(path.join(targetDir, name));
    }
  }

  const generatedAt = new Date().toISOString();
  for (const [name, frozenContent] of expected) {
    const content = frozenContent.replace(FROZEN_TIMESTAMP, generatedAt);
    fs.writeFileSync(path.join(targetDir, name), content, 'utf8');
  }
}
