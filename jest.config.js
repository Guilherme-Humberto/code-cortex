/** Jest config for TypeScript tests */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/src/**/__tests__/**/*.test.ts',
    '**/src/**/__tests__/*.test.ts'
  ],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^vscode$': '<rootDir>/src/__tests__/__mocks__/vscode.ts',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  transform: {
    '^.+\\.(t|j)s?$': [
      '@swc/jest',
      {
        sourceMaps: 'inline',
        module: {
          type: 'commonjs',
          strict: true
        },
        jsc: {
          target: 'es2020',
          parser: {
            syntax: 'typescript',
            decorators: true
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true
          },
          keepClassNames: true
        }
      }
    ]
  },

  // Coverage configuration
  collectCoverage: false,
  collectCoverageFrom: [
    'src/infra/core/context/{file-selection,selected-file-context}.ts',
    'src/infra/core/commands/impact/{impact-analysis.service,impact-prompt}.ts',
    'src/infra/core/utils/token-budget.util.ts',
    'src/capabilities/knowledge/commands/{knowledge-context,knowledge-prompt}.ts'
  ],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
