// Diretório padrão onde os arquivos de memória são armazenados.
export const MEMORY_PATH = 'code-cortex';

// Subdiretório que agrupa toda a documentação funcional (sincronizada e extraída do código).
export const DOCUMENTATION_DIRECTORY = 'documentation';

// Subdiretório com documentação sincronizada de fontes externas (GitHub/SharePoint/local).
export const KNOWLEDGE_DIRECTORY = 'knowledge';

// Subdiretório com documentação extraída de comentários @code_cortex no próprio código.
export const REPOSITORY_DOCS_DIRECTORY = 'repository';

// Subdiretório onde a extensão provisiona scripts autônomos (ex: check de pre-commit).
export const SCRIPTS_DIRECTORY = '.scripts';

// Subdiretório com o histórico (log de auditoria) de análises e consultas já executadas.
export const HISTORY_DIRECTORY = '.history';

// Nome do script de verificação de documentação de repositório provisionado no workspace.
export const REPOSITORY_DOCS_SCRIPT_FILE = 'check-repository-docs.js';

// Chave do workspaceState que armazena os arquivos em foco para análise de impacto.
export const IMPACT_STATE_KEY = 'impact.selection';

// Chave do workspaceState que armazena o modelo de IA selecionado.
export const SELECTED_MODEL_KEY = 'knowledge.selectedModelId';

// Chave do workspaceState que armazena o provider de IA selecionado.
export const SELECTED_PROVIDER_KEY = 'knowledge.selectedProviderId';

// Chave do workspaceState que armazena o contexto da última análise de impacto (usado na reanálise).
export const LAST_CHANGE_CONTEXT_KEY = 'impact.lastChangeContext';
