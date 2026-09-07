import * as vscode from 'vscode';

import {
  MEMORY_PATH,
  REPOSITORY_DOCS_SCRIPT_FILE,
  SCRIPTS_DIRECTORY
} from '@/infra/core/constants';

const PROMPT_HANDLED_KEY = 'codeCortex.preCommitScripts.promptHandled';

const PROVISIONED_SCRIPT_FILES = [REPOSITORY_DOCS_SCRIPT_FILE];

const DESIRED_SCRIPTS: Record<string, string> = {
  'code-cortex:docgen': `node ${MEMORY_PATH}/${SCRIPTS_DIRECTORY}/${REPOSITORY_DOCS_SCRIPT_FILE}`
};

/**
 * Copia o CLI de docs de repositório (bundlado dentro da extensão) para o
 * workspace do usuário, para funcionar em pre-commit/CI sem depender da
 * extensão estar instalada.
 */
export async function provisionRepositoryDocsScript(
  context: vscode.ExtensionContext,
  workspace: vscode.WorkspaceFolder
): Promise<void> {
  for (const scriptFile of PROVISIONED_SCRIPT_FILES) {
    await provisionScript(context, workspace, scriptFile);
  }
}

async function provisionScript(
  context: vscode.ExtensionContext,
  workspace: vscode.WorkspaceFolder,
  scriptFile: string
): Promise<void> {
  const sourceUri = vscode.Uri.joinPath(
    context.extensionUri,
    'dist',
    scriptFile
  );
  const targetUri = vscode.Uri.joinPath(
    workspace.uri,
    MEMORY_PATH,
    SCRIPTS_DIRECTORY,
    scriptFile
  );

  let bundledScript: Uint8Array;
  try {
    bundledScript = await vscode.workspace.fs.readFile(sourceUri);
  } catch {
    // build de desenvolvimento sem o CLI gerado em dist/ ainda
    return;
  }

  const isUpToDate = await hasSameContent(targetUri, bundledScript);
  if (isUpToDate) {
    return;
  }

  await vscode.workspace.fs.createDirectory(
    vscode.Uri.joinPath(workspace.uri, MEMORY_PATH, SCRIPTS_DIRECTORY)
  );
  await vscode.workspace.fs.writeFile(targetUri, bundledScript);
}

/**
 * Observa o arquivo do CLI provisionado e o recria imediatamente caso o
 * usuário apague a pasta `.scripts` (ou o arquivo) durante a sessão.
 */
export function watchRepositoryDocsScript(
  context: vscode.ExtensionContext,
  workspace: vscode.WorkspaceFolder
): vscode.Disposable {
  const pattern = new vscode.RelativePattern(
    workspace.uri,
    `${MEMORY_PATH}/${SCRIPTS_DIRECTORY}/**`
  );
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);

  const reprovision = () =>
    void provisionRepositoryDocsScript(context, workspace).catch(error =>
      console.error('CodeCortex: falha ao restaurar .scripts', error)
    );

  watcher.onDidDelete(reprovision);

  return watcher;
}

/**
 * Pergunta uma única vez por workspace se o usuário quer adicionar o script
 * `code-cortex:docgen` ao `package.json` do projeto, para uso em pre-commit/CI.
 */
export async function offerPackageJsonScripts(
  context: vscode.ExtensionContext,
  workspace: vscode.WorkspaceFolder
): Promise<void> {
  if (context.workspaceState.get<boolean>(PROMPT_HANDLED_KEY, false)) {
    return;
  }

  const packageJsonUri = vscode.Uri.joinPath(workspace.uri, 'package.json');
  const raw = await tryReadText(packageJsonUri);
  if (!raw) {
    return;
  }

  const missingKeys = findMissingScriptKeys(raw);
  if (missingKeys.length === 0) {
    await context.workspaceState.update(PROMPT_HANDLED_KEY, true);
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    'O CodeCortex pode adicionar o script npm (code-cortex:docgen) ao package.json deste projeto, para gerar a documentação extraída do código em pre-commit/CI.',
    'Adicionar',
    'Agora não',
    'Não perguntar novamente'
  );

  if (choice === 'Adicionar') {
    const updated = insertScriptsIntoPackageJson(raw, missingKeys);
    await vscode.workspace.fs.writeFile(
      packageJsonUri,
      Buffer.from(updated, 'utf8')
    );
    vscode.window.showInformationMessage(
      'Script code-cortex:docgen adicionado ao package.json.'
    );
  }

  if (choice === 'Adicionar' || choice === 'Não perguntar novamente') {
    await context.workspaceState.update(PROMPT_HANDLED_KEY, true);
  }
}

async function hasSameContent(
  fileUri: vscode.Uri,
  expected: Uint8Array
): Promise<boolean> {
  try {
    const current = await vscode.workspace.fs.readFile(fileUri);
    return Buffer.compare(Buffer.from(current), Buffer.from(expected)) === 0;
  } catch {
    return false;
  }
}

async function tryReadText(uri: vscode.Uri): Promise<string | undefined> {
  try {
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf8');
  } catch {
    return undefined;
  }
}

function findMissingScriptKeys(rawPackageJson: string): string[] {
  let parsed: { scripts?: Record<string, string> };
  try {
    parsed = JSON.parse(rawPackageJson);
  } catch {
    return [];
  }

  const existingScripts = parsed.scripts ?? {};
  return Object.keys(DESIRED_SCRIPTS).filter(key => !(key in existingScripts));
}

function insertScriptsIntoPackageJson(
  rawPackageJson: string,
  missingKeys: readonly string[]
): string {
  const scriptsBlockMatch = rawPackageJson.match(/"scripts"\s*:\s*\{/);
  if (!scriptsBlockMatch || scriptsBlockMatch.index === undefined) {
    return rawPackageJson;
  }

  const insertAt = scriptsBlockMatch.index + scriptsBlockMatch[0].length;
  const nextLineMatch = rawPackageJson.slice(insertAt).match(/\n(\s*)"/);
  const indent = nextLineMatch ? nextLineMatch[1] : '    ';

  const newEntries = missingKeys
    .map(
      key =>
        `\n${indent}${JSON.stringify(key)}: ${JSON.stringify(DESIRED_SCRIPTS[key])},`
    )
    .join('');

  return (
    rawPackageJson.slice(0, insertAt) +
    newEntries +
    rawPackageJson.slice(insertAt)
  );
}
