import * as vscode from 'vscode';

export async function syncFromSharepointSimulation(
  product?: string,
  project?: string
): Promise<void> {
  const normalizedProduct = product?.trim();
  const normalizedProject = project?.trim();
  if (!normalizedProduct || !normalizedProject) {
    vscode.window.showWarningMessage('Informe o produto e o projeto.');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'Sincronizando documentação do SharePoint (simulação)...',
      cancellable: false
    },
    async () => {
      await new Promise(resolve => setTimeout(resolve, 350));
    }
  );

  vscode.window.showInformationMessage(
    'Sincronização SharePoint (simulada) concluída.'
  );
}
