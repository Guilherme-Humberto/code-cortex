import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { run } from '../check-repository-docs';

describe('check-repository-docs CLI', () => {
  let rootDir: string;

  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'code-cortex-cli-'));
  });

  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  function writeFile(relativePath: string, content: string): void {
    const fullPath = path.join(rootDir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  function readGeneratedDoc(fileName: string): string {
    return fs.readFileSync(
      path.join(rootDir, 'code-cortex/documentation/repository', fileName),
      'utf8'
    );
  }

  it('generates one Markdown file per @code_cortex block found in the source tree', async () => {
    writeFile('package.json', '{}');
    writeFile(
      'src/controller.ts',
      [
        '/**',
        ' * @code_cortex open',
        ' * @title Cancelar agendamentos',
        ' * @links package.json',
        ' * @code_cortex close',
        ' */',
        'export const x = 1;'
      ].join('\n')
    );

    const exitCode = await run(rootDir);

    expect(exitCode).toBe(0);
    const content = readGeneratedDoc('cancelar-agendamentos.md');
    expect(content).toContain('title: Cancelar agendamentos');
    expect(content).toContain('sourceFile: src/controller.ts');
  });

  it('fails and reports broken @links pointing to non-existent files', async () => {
    writeFile(
      'src/controller.ts',
      [
        '/**',
        ' * @code_cortex open',
        ' * @title Bloco com link quebrado',
        ' * @links src/inexistente.ts',
        ' * @code_cortex close',
        ' */'
      ].join('\n')
    );

    const errorSpy = jest.spyOn(console, 'error').mockImplementation();

    const exitCode = await run(rootDir);

    expect(exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('@links quebrados')
    );
    errorSpy.mockRestore();
  });

  it('ignores files inside node_modules and other ignored directories', async () => {
    writeFile(
      'node_modules/pkg/index.ts',
      '/**\n * @code_cortex open\n * @title Não deve aparecer\n * @code_cortex close\n */'
    );

    const exitCode = await run(rootDir);

    expect(exitCode).toBe(0);
    expect(
      fs.existsSync(path.join(rootDir, 'code-cortex/documentation/repository'))
    ).toBe(true);
    expect(
      fs.readdirSync(path.join(rootDir, 'code-cortex/documentation/repository'))
    ).toEqual([]);
  });

  it('removes stale generated files that no longer correspond to a block', async () => {
    fs.mkdirSync(path.join(rootDir, 'code-cortex/documentation/repository'), {
      recursive: true
    });
    writeFile(
      'code-cortex/documentation/repository/antigo.md',
      '# Documento antigo, deve ser removido'
    );

    const exitCode = await run(rootDir);

    expect(exitCode).toBe(0);
    expect(
      fs.readdirSync(path.join(rootDir, 'code-cortex/documentation/repository'))
    ).toEqual([]);
  });
});
