/**
 * long-options.test.ts — which answers count as too long for a row (2026-11-18).
 */
import { describe, expect, test } from 'vitest';
import { hasLongOption, LONG_OPTION_CHARS } from './long-options';

describe('hasLongOption', () => {
  test(`is false when every option is at most ${LONG_OPTION_CHARS} characters`, () => {
    expect(hasLongOption([['a'.repeat(LONG_OPTION_CHARS), 'b'], ['c']])).toBe(false);
  });

  test(`is true when any option in any group is longer than ${LONG_OPTION_CHARS}`, () => {
    expect(hasLongOption([['short'], ['ok', 'x'.repeat(LONG_OPTION_CHARS + 1)]])).toBe(true);
  });

  test('is false for no groups', () => {
    expect(hasLongOption([])).toBe(false);
  });
});
