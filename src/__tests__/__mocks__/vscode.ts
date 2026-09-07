export class MarkdownString {
  public value: string;

  constructor(value: string) {
    this.value = value;
  }
}

export class Uri {
  constructor(public readonly fsPath: string) {}

  static joinPath(base: Uri, ...paths: string[]): Uri {
    return new Uri([base.fsPath, ...paths].join('/'));
  }
}

export class LanguageModelToolResult {
  constructor(public content: readonly unknown[]) {}
}

export class LanguageModelTextPart {
  constructor(public value: string) {}
}

export class CancellationToken {}

export class CancellationTokenSource {
  public readonly token = new CancellationToken();

  dispose(): void {}
}

export class ChatResponseTurn {}

export class ChatResponseMarkdownPart {
  constructor(public value: string) {}
}

export class LanguageModelChatMessage {
  public static Assistant(content: string, role = 'assistant') {
    return { role, content };
  }

  public static User(content: string) {
    return { role: 'user', content };
  }
}

export const chat = {
  createChatParticipant: () => ({
    dispose: () => undefined
  })
};

export const lm = {
  registerTool: () => ({
    dispose: () => undefined
  }),
  selectChatModels: async () => [] as any[]
};

export const window = {
  showInformationMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  activeTextEditor: undefined as any
};

export const workspace = {
  getWorkspaceFolder: () => undefined,
  workspaceFolders: [] as any[],
  asRelativePath: (uri: Uri) => uri.fsPath,
  onDidChangeWorkspaceFolders: () => ({ dispose: () => undefined }),
  createFileSystemWatcher: () => ({
    onDidCreate: () => ({ dispose: () => undefined }),
    onDidChange: () => ({ dispose: () => undefined }),
    onDidDelete: () => ({ dispose: () => undefined }),
    dispose: () => undefined
  }),
  FileType: {
    File: 1,
    Directory: 2
  },
  fs: {
    readFile: async () => new Uint8Array(),
    readDirectory: async () => [] as [string, number][],
    createDirectory: async () => undefined,
    writeFile: async () => undefined,
    stat: async () => ({ size: 0 }) as any,
    delete: async () => undefined
  }
};

export class RelativePattern {
  constructor(
    public readonly base: Uri,
    public readonly pattern: string
  ) {}
}

export const FileType = {
  File: 1,
  Directory: 2
};

export const env = {};
