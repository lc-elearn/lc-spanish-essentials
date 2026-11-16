/**
 * answer-alternatives.test.ts — a typed answer may accept more than one form, split by
 * `|`, the first preferred (TODO §E54). The split is the one place this happens.
 */
import { describe, expect, test } from 'vitest';
import { splitAlternatives } from './answer-alternatives';

describe('splitAlternatives', () => {
  test('one answer is a list of one', () => {
    expect(splitAlternatives('soy')).toEqual(['soy']);
  });

  test('several answers, in authored order', () => {
    expect(splitAlternatives('обеспеченные|состоятельные|богатые')).toEqual([
      'обеспеченные',
      'состоятельные',
      'богатые',
    ]);
  });

  test('trims the spaces around each |, and keeps the spaces inside an answer', () => {
    expect(splitAlternatives(' в семейном кругу | в кругу семьи |в семье')).toEqual([
      'в семейном кругу',
      'в кругу семьи',
      'в семье',
    ]);
  });

  test('keeps an empty part, so the load check can name it', () => {
    expect(splitAlternatives('a||b')).toEqual(['a', '', 'b']);
    expect(splitAlternatives('a|')).toEqual(['a', '']);
    expect(splitAlternatives('a| |b')).toEqual(['a', '', 'b']);
    expect(splitAlternatives('')).toEqual(['']);
  });
});
