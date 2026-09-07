const esbuild = require('esbuild');

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
  name: 'esbuild-problem-matcher',

  setup(build) {
    build.onStart(() => {
      console.log('[watch] build started');
    });
    build.onEnd(result => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log('[watch] build finished');
    });
  }
};

async function main() {
  const ctx = await esbuild.context({
    entryPoints: ['src/extensions.ts'],
    bundle: true,
    format: 'cjs',
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: 'node',
    outfile: 'dist/extension.js',
    external: ['vscode'],
    logLevel: 'silent',
    alias: {
      '@': './src'
    },
    plugins: [
      /* add to the end of plugins array */
      esbuildProblemMatcherPlugin
    ]
  });
  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }

  // CLI autônomo (sem dependência de `vscode`) que a extensão copia para dentro
  // do workspace do usuário, para uso em pre-commit/CI de qualquer projeto.
  await esbuild.build({
    entryPoints: [
      'src/capabilities/repository-docs/cli/check-repository-docs.entry.ts'
    ],
    bundle: true,
    format: 'cjs',
    minify: production,
    platform: 'node',
    outfile: 'dist/check-repository-docs.js',
    logLevel: 'silent'
  });
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
