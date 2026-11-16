/**
 * block-options-schemas.test.ts — which block types take `options` (E63).
 */
import { expect, test } from 'vitest';
import { blockOptionsSchema } from './block-options-schemas';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';

test('vocabulary takes options; other types and prototype keys do not', () => {
  expect(blockOptionsSchema('vocabulary')).toBe(VocabularyBlockOptionsSchema);
  expect(blockOptionsSchema('prose')).toBeUndefined();
  expect(blockOptionsSchema('toString')).toBeUndefined();
});

test('the vocabulary options default off and refuse unknown keys', () => {
  expect(VocabularyBlockOptionsSchema.parse({})).toEqual({
    selfTest: false,
    letterHeadings: false,
  });
  expect(VocabularyBlockOptionsSchema.safeParse({ sort: false }).success).toBe(false);
});
