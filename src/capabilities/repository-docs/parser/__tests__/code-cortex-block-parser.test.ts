import { extractCodeCortexBlocks } from '../code-cortex-block-parser';

describe('code-cortex-block-parser', () => {
  it('extracts title, description, links and content from a JSDoc-style block', () => {
    const source = `
    /**
     * @code_cortex open
     * @title Cancelar agendamentos
     * @description Cancela um agendamento pelo seu ID.
     * @links src/a.ts, src/b.ts
     * @content
     * Primeira linha.
     *
     * Segunda linha.
     * @code_cortex close
     */
    `;

    expect(extractCodeCortexBlocks(source)).toEqual([
      {
        title: 'Cancelar agendamentos',
        description: 'Cancela um agendamento pelo seu ID.',
        links: ['src/a.ts', 'src/b.ts'],
        content: 'Primeira linha.\n\nSegunda linha.'
      }
    ]);
  });

  it('extracts multiple blocks from the same file', () => {
    const source = `
    /**
     * @code_cortex open
     * @title Bloco 1
     * @code_cortex close
     */

    /**
     * @code_cortex open
     * @title Bloco 2
     * @code_cortex close
     */
    `;

    const blocks = extractCodeCortexBlocks(source);
    expect(blocks).toHaveLength(2);
    expect(blocks.map(block => block.title)).toEqual(['Bloco 1', 'Bloco 2']);
  });

  it('ignores a block without @title', () => {
    const source = `
    /**
     * @code_cortex open
     * @description Sem título, não deve ser incluído.
     * @code_cortex close
     */
    `;

    expect(extractCodeCortexBlocks(source)).toEqual([]);
  });

  it('returns an empty array when there is no @code_cortex block', () => {
    expect(extractCodeCortexBlocks('const x = 1;')).toEqual([]);
  });

  it('defaults optional fields when only @title is present', () => {
    const source = `
    /**
     * @code_cortex open
     * @title Só título
     * @code_cortex close
     */
    `;

    expect(extractCodeCortexBlocks(source)).toEqual([
      {
        title: 'Só título',
        description: undefined,
        links: [],
        content: ''
      }
    ]);
  });
});
