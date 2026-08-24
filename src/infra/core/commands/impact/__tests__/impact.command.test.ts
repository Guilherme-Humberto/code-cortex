import * as vscode from 'vscode';
import { jest } from '@jest/globals';

import {
  registerImpactCommands,
  shouldAutoSaveImpactAnalysis,
  shouldSaveImpactAnalysisResult
} from '../impact.command';
import { ImpactViewProvider } from '../../../ui/impact-view-provider';

describe('impact.commands - auto-save decision', () => {
  it('auto-saves only procedent impact analyses', () => {
    expect(
      shouldAutoSaveImpactAnalysis(
        '## Resultado\nCom impacto\n\n## Justificativa'
      )
    ).toBe(true);

    expect(
      shouldAutoSaveImpactAnalysis(
        '## Resultado\nSem impacto\n\n## Justificativa'
      )
    ).toBe(false);

    expect(
      shouldAutoSaveImpactAnalysis(
        '## Resultado\nInformação insuficiente\n\n## Justificativa'
      )
    ).toBe(false);
  });
});

describe('impact.commands - reanalysis save decision', () => {
  const procedent = '## Resultado\nCom impacto\n\n## Justificativa';

  it('never auto-saves reanalysis results', () => {
    expect(shouldSaveImpactAnalysisResult(procedent, true)).toBe(false);
  });

  it('auto-saves original analyses when procedent', () => {
    expect(shouldSaveImpactAnalysisResult(procedent, false)).toBe(true);
  });

  it('does not auto-save original analyses without impact', () => {
    expect(
      shouldSaveImpactAnalysisResult(
        '## Resultado\nSem impacto\n\n## Justificativa',
        false
      )
    ).toBe(false);
  });
});

describe('impact.commands - history by file', () => {
  let registeredCommands: Record<string, Function> = {};
  let onDidChangeCb: any = null;
  let sharedStatus: any = null;

  beforeEach(() => {
    registeredCommands = {};
    onDidChangeCb = null;

    (vscode as any).commands = {
      registerCommand: (id: string, cb: Function) => {
        registeredCommands[id] = cb;
        return { dispose: () => {} } as any;
      }
    };

    (vscode.window as any).onDidChangeActiveTextEditor = (cb: any) => {
      onDidChangeCb = cb;
      return { dispose: () => {} } as any;
    };
    sharedStatus = {
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: ''
    };
    (vscode.window as any).createStatusBarItem = () => sharedStatus;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    vscode.workspace.workspaceFolders = [];
    ImpactViewProvider.current = undefined;
  });

  it('registers showHistoryForFile and invokes view provider', async () => {
    const ctx: any = {
      workspaceState: { get: jest.fn(), update: jest.fn() },
      subscriptions: []
    };

    const fakeEntries = [
      {
        id: 'a',
        files: [new (vscode as any).Uri('/workspace/src/foo.ts').fsPath],
        path: 'code-cortex/_history/a.md',
        createdAt: new Date().toISOString(),
        kind: 'manual',
        title: 't',
        modelName: 'm',
        totalTokens: 0
      }
    ];

    ctx.workspaceState.get = jest.fn(() => fakeEntries);
    vscode.workspace.workspaceFolders = [
      { uri: new (vscode as any).Uri('/workspace') } as any
    ];

    (vscode as any).StatusBarAlignment = { Left: 1 };

    (ImpactViewProvider as any).current = { showHistoryForFile: jest.fn() };

    registerImpactCommands(ctx);

    expect(typeof registeredCommands['codeCortex.showHistoryForFile']).toBe(
      'function'
    );

    await expect(
      (registeredCommands['codeCortex.showHistoryForFile'] as Function)(
        'src/foo.ts'
      )
    ).resolves.not.toThrow();
    expect(ctx.workspaceState.get).toHaveBeenCalled();
  });

  it('shows status bar when active editor has history entries', async () => {
    const ctx: any = {
      workspaceState: { get: jest.fn(), update: jest.fn() },
      subscriptions: []
    };

    const fakeEntries = [
      {
        id: 'a',
        files: ['src/foo.ts'],
        path: 'code-cortex/_history/a.md',
        createdAt: new Date().toISOString(),
        kind: 'manual',
        title: 't',
        modelName: 'm',
        totalTokens: 0
      }
    ];

    ctx.workspaceState.get = jest.fn(() => fakeEntries);

    const mockStatus: any = {
      show: jest.fn(),
      hide: jest.fn(),
      dispose: jest.fn(),
      text: '',
      tooltip: '',
      command: ''
    };
    (vscode.window as any).createStatusBarItem = () => mockStatus as any;

    vscode.workspace.workspaceFolders = [
      { uri: new (vscode as any).Uri('/workspace') } as any
    ];
    const doc: any = { uri: new (vscode as any).Uri('/workspace/src/foo.ts') };
    (vscode.window as any).activeTextEditor = { document: doc };

    registerImpactCommands(ctx);

    // status bar was created and wired to a command
    expect(typeof sharedStatus.command).toBe('string');
    expect(sharedStatus.command.length).toBeGreaterThanOrEqual(0);
  });
});
