import * as vscode from 'vscode';

/**
 * Gerencia o ciclo de vida de múltiplos objetos Disposable.
 *
 * Útil para agrupar subscriptions, watchers e recursos
 * que precisam ser liberados juntos.
 */
export class DisposableStore {
  private readonly disposables: vscode.Disposable[] = [];
  private disposed = false;

  /**
   * Adiciona um novo recurso para ser descartado futuramente.
   */
  public add(disposable: vscode.Disposable): void {
    if (this.disposed) {
      console.warn(
        'DisposableStore já foi descartado. O recurso não será gerenciado.'
      );
      return;
    }

    this.disposables.push(disposable);
  }

  /**
   * Descarta todos os recursos registrados.
   *
   * Continua executando os demais disposes mesmo que algum
   * recurso apresente erro durante a liberação.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    const errors: Error[] = [];

    while (this.disposables.length > 0) {
      const disposable = this.disposables.pop();

      if (!disposable) {
        continue;
      }

      try {
        disposable.dispose();
      } catch (error) {
        errors.push(this.normalizeError(error));
      }
    }

    this.logDisposeErrors(errors);
  }

  /**
   * Indica se o store já foi descartado.
   */
  public get isDisposed(): boolean {
    return this.disposed;
  }

  /**
   * Normaliza qualquer erro lançado para uma instância de Error.
   */
  private normalizeError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
  }

  /**
   * Registra erros ocorridos durante o descarte dos recursos.
   */
  private logDisposeErrors(errors: Error[]): void {
    if (errors.length === 0) {
      return;
    }

    console.error(
      `Errors during DisposableStore disposal: ${errors
        .map(error => error.message)
        .join(', ')}`
    );
  }
}
