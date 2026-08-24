import * as vscode from 'vscode';

import {
  estimateImpactPromptTokens,
  runImpactAnalysis
} from '../impact-analysis.service';

describe('impact-analysis.service', () => {
  const input = {
    knowledgeDocs: [],
    files: [
      {
        path: 'src/cancel.ts',
        language: 'typescript',
        content: 'export function cancel() {}',
        truncated: false
      }
    ]
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs the selected model and returns the response metrics', async () => {
    const model = {
      id: 'model-1',
      name: 'Auto',
      sendRequest: jest.fn().mockResolvedValue({
        text: (async function* () {
          yield '## Resumo';
          yield '\nResultado';
        })()
      })
    };
    jest.spyOn(vscode.lm, 'selectChatModels').mockResolvedValue([model] as any);

    const result = await runImpactAnalysis(
      undefined,
      input,
      new vscode.CancellationToken()
    );

    expect(model.sendRequest).toHaveBeenCalledTimes(1);
    expect(result.markdown).toBe('## Resumo\nResultado');
    expect(result.modelName).toBe('Auto');
    expect(result.totalTokens).toBeGreaterThan(0);
  });

  it('falls back to an available model when the saved model is missing', async () => {
    const fallbackModel = {
      id: 'fallback',
      name: 'Claude',
      sendRequest: jest.fn().mockResolvedValue({
        text: (async function* () {
          yield 'answer';
        })()
      })
    };
    const select = jest
      .spyOn(vscode.lm, 'selectChatModels')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([fallbackModel] as any);

    const result = await runImpactAnalysis(
      undefined,
      input,
      new vscode.CancellationToken(),
      'missing'
    );

    expect(select).toHaveBeenCalledTimes(2);
    expect(result.modelName).toBe('Claude');
  });

  it('fails when no model is available', async () => {
    jest.spyOn(vscode.lm, 'selectChatModels').mockResolvedValue([]);

    await expect(
      runImpactAnalysis(undefined, input, new vscode.CancellationToken())
    ).rejects.toThrow('Nenhum modelo');
  });

  it('estimates prompt tokens from the same prompt used by the service', () => {
    expect(estimateImpactPromptTokens(input)).toBeGreaterThan(0);
  });

  it('accepts an ExtensionContext as the first argument', async () => {
    const model = {
      id: 'model-ctx',
      name: 'CtxModel',
      sendRequest: jest.fn().mockResolvedValue({
        text: (async function* () {
          yield 'ctx answer';
        })()
      })
    };
    jest.spyOn(vscode.lm, 'selectChatModels').mockResolvedValue([model] as any);

    const fakeCtx = {
      workspaceState: { get: jest.fn(() => 'copilot') }
    } as any;

    const result = await runImpactAnalysis(
      fakeCtx,
      input,
      new vscode.CancellationToken()
    );

    expect(result.modelName).toBe('CtxModel');
    expect(model.sendRequest).toHaveBeenCalled();
  });

  it('throws when provider configured in context has no models', async () => {
    jest.spyOn(vscode.lm, 'selectChatModels').mockResolvedValue([]);
    const fakeCtx = {
      workspaceState: { get: jest.fn(() => 'no-provider') }
    } as any;

    await expect(
      runImpactAnalysis(fakeCtx, input, new vscode.CancellationToken())
    ).rejects.toThrow('Nenhum modelo');
  });
});
