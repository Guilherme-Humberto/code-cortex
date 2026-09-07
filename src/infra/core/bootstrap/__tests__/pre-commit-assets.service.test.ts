import * as vscode from 'vscode';

import {
  offerPackageJsonScripts,
  provisionRepositoryDocsScript,
  watchRepositoryDocsScript
} from '../pre-commit-assets.service';

describe('pre-commit-assets.service', () => {
  const workspace = { uri: new vscode.Uri('/workspace') } as any;
  const context = {
    extensionUri: new vscode.Uri('/extension'),
    workspaceState: {
      get: jest.fn(() => false),
      update: jest.fn().mockResolvedValue(undefined)
    }
  } as any;

  afterEach(() => {
    jest.restoreAllMocks();
    context.workspaceState.get.mockReturnValue(false);
  });

  describe('provisionRepositoryDocsScript', () => {
    it('copies the bundled CLI into code-cortex/.scripts when it is missing/outdated', async () => {
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockImplementation(async (uri: vscode.Uri) => {
          if (uri.fsPath === '/extension/dist/check-repository-docs.js') {
            return Buffer.from('bundled-content');
          }
          throw new Error('target not found yet');
        });
      const createDirectory = jest.spyOn(
        vscode.workspace.fs,
        'createDirectory'
      );
      const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');

      await provisionRepositoryDocsScript(context, workspace);

      expect(createDirectory).toHaveBeenCalledWith(
        expect.objectContaining({
          fsPath: '/workspace/code-cortex/.scripts'
        })
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.objectContaining({
          fsPath: '/workspace/code-cortex/.scripts/check-repository-docs.js'
        }),
        expect.anything()
      );
    });

    it('does nothing when the target already has the same content', async () => {
      const bundled = Buffer.from('bundled-content');
      jest.spyOn(vscode.workspace.fs, 'readFile').mockResolvedValue(bundled);
      const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');

      await provisionRepositoryDocsScript(context, workspace);

      expect(writeFile).not.toHaveBeenCalled();
    });

    it('does nothing when the extension has not built the CLI yet (dev mode)', async () => {
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockRejectedValue(new Error('ENOENT'));
      const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');

      await provisionRepositoryDocsScript(context, workspace);

      expect(writeFile).not.toHaveBeenCalled();
    });
  });

  describe('watchRepositoryDocsScript', () => {
    it('registers a file watcher that reprovisions the script on delete', () => {
      const onDidDelete = jest.fn();
      jest.spyOn(vscode.workspace, 'createFileSystemWatcher').mockReturnValue({
        onDidDelete,
        onDidCreate: jest.fn(),
        onDidChange: jest.fn(),
        dispose: jest.fn()
      } as any);

      watchRepositoryDocsScript(context, workspace);

      expect(onDidDelete).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('offerPackageJsonScripts', () => {
    it('does nothing when the prompt was already handled for this workspace', async () => {
      context.workspaceState.get.mockReturnValue(true);
      const showInformationMessage = jest.spyOn(
        vscode.window,
        'showInformationMessage'
      );

      await offerPackageJsonScripts(context, workspace);

      expect(showInformationMessage).not.toHaveBeenCalled();
    });

    it('adds the docgen script and marks the prompt as handled when the user accepts', async () => {
      const packageJson = '{\n  "scripts": {\n    "test": "jest"\n  }\n}';
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockResolvedValue(Buffer.from(packageJson));
      const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');
      jest
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValueOnce('Adicionar' as any)
        .mockResolvedValueOnce(undefined);

      await offerPackageJsonScripts(context, workspace);

      expect(writeFile).toHaveBeenCalledWith(
        expect.objectContaining({ fsPath: '/workspace/package.json' }),
        expect.anything()
      );
      const [, bytes] = writeFile.mock.calls[0] as [vscode.Uri, Uint8Array];
      expect(Buffer.from(bytes).toString('utf8')).toContain(
        '"code-cortex:docgen"'
      );
      expect(context.workspaceState.update).toHaveBeenCalledWith(
        'codeCortex.preCommitScripts.promptHandled',
        true
      );
    });

    it('marks the prompt as handled without writing when the user declines permanently', async () => {
      const packageJson = '{ "scripts": {} }';
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockResolvedValue(Buffer.from(packageJson));
      const writeFile = jest.spyOn(vscode.workspace.fs, 'writeFile');
      jest
        .spyOn(vscode.window, 'showInformationMessage')
        .mockResolvedValue('Não perguntar novamente' as any);

      await offerPackageJsonScripts(context, workspace);

      expect(writeFile).not.toHaveBeenCalled();
      expect(context.workspaceState.update).toHaveBeenCalledWith(
        'codeCortex.preCommitScripts.promptHandled',
        true
      );
    });

    it('does nothing when package.json cannot be read', async () => {
      jest
        .spyOn(vscode.workspace.fs, 'readFile')
        .mockRejectedValue(new Error('ENOENT'));
      const showInformationMessage = jest.spyOn(
        vscode.window,
        'showInformationMessage'
      );

      await offerPackageJsonScripts(context, workspace);

      expect(showInformationMessage).not.toHaveBeenCalled();
    });
  });
});
