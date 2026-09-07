import {
  buildMarkdown,
  createUniqueSlug,
  slugify,
  stripGeneratedAt
} from '../repository-docs-markdown';

describe('repository-docs-markdown', () => {
  describe('buildMarkdown', () => {
    it('renders frontmatter and content for a full block', () => {
      const markdown = buildMarkdown(
        {
          title: 'Cancelar agendamentos',
          description: 'Cancela um agendamento pelo seu ID.',
          links: ['src/a.ts', 'src/b.ts'],
          content: 'Regra de negócio detalhada.',
          sourceFile: 'src/controllers/cancel.controller.ts'
        },
        '2026-01-01T00:00:00.000Z'
      );

      expect(markdown).toContain('title: Cancelar agendamentos');
      expect(markdown).toContain(
        'description: Cancela um agendamento pelo seu ID.'
      );
      expect(markdown).toContain(
        'sourceFile: src/controllers/cancel.controller.ts'
      );
      expect(markdown).toContain('  - src/a.ts');
      expect(markdown).toContain('  - src/b.ts');
      expect(markdown).toContain('generatedAt: 2026-01-01T00:00:00.000Z');
      expect(markdown).toContain('# Cancelar agendamentos');
      expect(markdown).toContain('Regra de negócio detalhada.');
    });

    it('omits the description line and falls back on empty content', () => {
      const markdown = buildMarkdown(
        {
          title: 'Sem descrição',
          links: [],
          content: '',
          sourceFile: 'src/a.ts'
        },
        '2026-01-01T00:00:00.000Z'
      );

      expect(markdown).not.toContain('description:');
      expect(markdown).toContain('_Sem conteúdo descrito._');
    });
  });

  describe('stripGeneratedAt', () => {
    it('normalizes the generatedAt line so timestamps do not affect comparison', () => {
      const a = 'generatedAt: 2026-01-01T00:00:00.000Z\ncontent';
      const b = 'generatedAt: 2026-02-02T10:00:00.000Z\ncontent';

      expect(stripGeneratedAt(a)).toBe(stripGeneratedAt(b));
    });
  });

  describe('createUniqueSlug + slugify', () => {
    it('slugifies accents, spaces and uppercase letters', () => {
      expect(slugify('Cancelar Agendaménto!')).toBe('cancelar-agendamento');
    });

    it('falls back to a default slug for an empty/symbol-only title', () => {
      expect(slugify('###')).toBe('documento');
    });

    it('appends an incrementing suffix for repeated titles', () => {
      const used = new Map<string, number>();
      expect(createUniqueSlug('Mesmo título', used)).toBe('mesmo-titulo');
      expect(createUniqueSlug('Mesmo título', used)).toBe('mesmo-titulo-1');
      expect(createUniqueSlug('Mesmo título', used)).toBe('mesmo-titulo-2');
    });
  });
});
