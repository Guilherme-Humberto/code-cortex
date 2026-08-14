import { distributeBudget, estimateTokenCount } from '../token-budget.util';

describe('token-budget', () => {
  it('estimates tokens from character count', () => {
    expect(estimateTokenCount('')).toBe(0);
    expect(estimateTokenCount('12345')).toBe(2);
  });

  it('distributes a budget proportionally when content exceeds it', () => {
    expect(distributeBudget(4, ['123456789012', '12345678'])).toEqual([2, 1]);
  });

  it('keeps original counts when under budget and handles no items', () => {
    expect(distributeBudget(100, ['1234', '12345678'])).toEqual([1, 2]);
    expect(distributeBudget(100, [])).toEqual([]);
  });
});
