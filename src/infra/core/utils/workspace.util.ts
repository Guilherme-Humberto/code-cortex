import * as vscode from 'vscode';
import * as path from 'node:path';
import * as fs from 'node:fs';

/**
 * Funções auxiliares relacionadas à descoberta de workspaces.
 */
export class WorkspaceUtil {
  /**
   * Verifica se a extensão está sendo executada em modo desenvolvimento.
   */
  public static isInExtensionDevelopmentHost(): boolean {
    return (
      process.env.VSCODE_EXTENSION_DEVELOPMENT_HOST === '1' ||
      process.env.VSCODE_EXTENSION_DEVELOPMENT === '1' ||
      process.env.VSCODE_DEBUG_MODE === 'true' ||
      this.hasDevelopmentFiles()
    );
  }

  /**
   * Localiza o workspace onde a extensão está sendo desenvolvida.
   *
   * Mantém múltiplas estratégias porque o Extension Development Host
   * pode possuir vários workspaces abertos simultaneamente.
   */
  public static getExtensionWorkspace(): vscode.WorkspaceFolder | undefined {
    const workspaces = vscode.workspace.workspaceFolders ?? [];

    if (workspaces.length === 0) {
      console.log('WorkspaceUtil: No workspace folders available.');
      return undefined;
    }

    console.log(
      `WorkspaceUtil: Available workspaces: ${workspaces
        .map(workspace => `${workspace.name}: ${workspace.uri.fsPath}`)
        .join(', ')}`
    );

    const strategies = [
      () => this.findByExtensionRoot(workspaces),
      () => this.findByPackageJson(workspaces),
      () => this.findByKnownPath(workspaces),
      () => this.findBySourceFiles(workspaces),
      () => this.findByDirectoryStructure(workspaces)
    ];

    for (const strategy of strategies) {
      const workspace = strategy();

      if (workspace) {
        return workspace;
      }
    }

    const firstWorkspace = workspaces[0];

    if (!firstWorkspace) {
      return undefined;
    }

    console.log(
      `WorkspaceUtil: Using first workspace as fallback: ${firstWorkspace.uri.fsPath}`
    );

    return firstWorkspace;
  }

  /**
   * Procura o workspace através da localização atual do código.
   */
  private static findByExtensionRoot(
    workspaces: readonly vscode.WorkspaceFolder[]
  ): vscode.WorkspaceFolder | undefined {
    try {
      const extensionRoot = path.resolve(__dirname, '..', '..');

      console.log(`WorkspaceUtil: Calculated extension root: ${extensionRoot}`);

      return workspaces.find(
        workspace =>
          extensionRoot.startsWith(workspace.uri.fsPath) ||
          workspace.uri.fsPath.includes('code-cortex')
      );
    } catch (error) {
      console.error('WorkspaceUtil: Error finding extension root:', error);

      return undefined;
    }
  }

  /**
   * Procura pelo workspace através do package.json da extensão.
   */
  private static findByPackageJson(
    workspaces: readonly vscode.WorkspaceFolder[]
  ): vscode.WorkspaceFolder | undefined {
    try {
      const extension = vscode.extensions.getExtension(
        'guilherme-local.code-cortex'
      );

      if (!extension) {
        return undefined;
      }

      for (const workspace of workspaces) {
        const packageJsonPath = path.join(workspace.uri.fsPath, 'package.json');

        if (!fs.existsSync(packageJsonPath)) {
          continue;
        }

        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, 'utf8')
          );

          if (
            ['code-cortex', 'code-cortex-extension'].includes(packageJson.name)
          ) {
            console.log(
              `WorkspaceUtil: Found extension workspace by package.json: ${workspace.uri.fsPath}`
            );

            return workspace;
          }
        } catch (error) {
          console.error(
            `WorkspaceUtil: Error reading ${packageJsonPath}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('WorkspaceUtil: Error checking extension:', error);
    }

    return undefined;
  }

  /**
   * Procura por caminhos conhecidos da extensão.
   */
  private static findByKnownPath(
    workspaces: readonly vscode.WorkspaceFolder[]
  ): vscode.WorkspaceFolder | undefined {
    const knownPath = '/home/asad/dev/code-cortex';

    return workspaces.find(
      workspace =>
        workspace.uri.fsPath === knownPath ||
        workspace.uri.fsPath.includes('code-cortex')
    );
  }

  /**
   * Procura pela estrutura de arquivos conhecida do projeto.
   */
  private static findBySourceFiles(
    workspaces: readonly vscode.WorkspaceFolder[]
  ): vscode.WorkspaceFolder | undefined {
    return workspaces.find(workspace => {
      const root = workspace.uri.fsPath;

      const hasRequiredFiles =
        this.hasFile(root, 'package.json') &&
        this.hasFile(root, 'src/extension.ts') &&
        this.hasFile(root, 'src/infra/memory/engine/memory.manager.ts');

      if (hasRequiredFiles) {
        console.log(
          `WorkspaceUtil: Found extension workspace by source files: ${root}`
        );

        return true;
      }

      const hasSpecificFiles =
        this.hasFile(root, 'src/infra/core/utils/workspace.util.ts') &&
        this.hasFile(root, 'src/infra/core/bootstrap/extension-initializer.ts');

      if (hasSpecificFiles) {
        console.log(
          `WorkspaceUtil: Found extension workspace by specific files: ${root}`
        );

        return true;
      }

      return (
        this.hasFile(root, 'code-cortex') && this.hasFile(root, 'package.json')
      );
    });
  }

  /**
   * Procura pela estrutura de diretórios da extensão.
   */
  private static findByDirectoryStructure(
    workspaces: readonly vscode.WorkspaceFolder[]
  ): vscode.WorkspaceFolder | undefined {
    return workspaces.find(workspace => {
      const root = workspace.uri.fsPath;

      const validStructure =
        this.hasFile(root, 'src/infra/memory') &&
        this.hasFile(root, 'src/infra/core');

      if (validStructure) {
        console.log(
          `WorkspaceUtil: Found extension workspace by directory structure: ${root}`
        );
      }

      return validStructure;
    });
  }

  /**
   * Verifica existência de arquivo ou diretório.
   */
  private static hasFile(root: string, relativePath: string): boolean {
    return fs.existsSync(path.join(root, relativePath));
  }

  /**
   * Verifica arquivos usados para identificar ambiente de desenvolvimento.
   */
  private static hasDevelopmentFiles(): boolean {
    return (
      fs.existsSync(path.join(__dirname, '..', '..', 'src')) ||
      fs.existsSync(path.join(__dirname, '..', '..', 'tsconfig.json'))
    );
  }
}
