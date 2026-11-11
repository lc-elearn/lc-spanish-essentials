/**
 * answer-checks.test.ts — the load checks for a typed answer with more than one form
 * (TODO §E54): none empty, none accepted twice, compared as the engine grades. Each
 * returns the END of a sentence; the schema starts it ("row 2 …", "the blank […] …").
 */
import { describe, expect, test } from 'vitest';
import { normalizeAnswer, normalizeForDictation } from './answers';
import {
  emptyAlternativeProblems,
  hasTypedAnswer,
  repeatedAlternativeProblems,
  typedAnswerProblems,
} from './answer-checks';

const EMPTY = 'has an empty answer: remove the extra |';

describe('typedAnswerProblems', () => {
  test('finds nothing wrong with one answer or several', () => {
    expect(typedAnswerProblems('soy', normalizeAnswer)).toEqual([]);
    expect(typedAnswerProblems('обеспеченные|состоятельные|богатые', normalizeAnswer)).toEqual([]);
  });

  test.each(['a|', '|a', 'a||b', 'a| |b'])('names an empty answer: %s', (answer) => {
    expect(typedAnswerProblems(answer, normalizeAnswer)).toEqual([EMPTY]);
  });

  test('leaves a lone empty answer to the "has no answer" check', () => {
    expect(typedAnswerProblems(' ', normalizeAnswer)).toEqual([]);
  });

  test('names an answer accepted twice, compared as grading compares', () => {
    expect(typedAnswerProblems('soy|eres|soy', normalizeAnswer)).toEqual([
      'accepts "soy" twice: each answer must differ',
    ]);
    expect(typedAnswerProblems("l'eau|l’eau", normalizeAnswer)).toEqual([
      `accepts "l'eau" twice: each answer must differ`,
    ]);
  });

  test('judges as written: an entity is not decoded', () => {
    expect(typedAnswerProblems('é|&eacute;', normalizeAnswer)).toEqual([]);
  });

  test('folds capitals unless the exercise is caseSensitive', () => {
    expect(typedAnswerProblems('Soy|soy', normalizeAnswer)).toEqual([
      'accepts "soy" twice: each answer must differ',
    ]);
    expect(typedAnswerProblems('Soy|soy', normalizeAnswer, true)).toEqual([]);
  });

  test("compares with the engine's own normalizing", () => {
    expect(typedAnswerProblems('Hola|¡Hola!', normalizeForDictation)).toEqual([
      'accepts "Hola" twice: each answer must differ',
    ]);
    expect(typedAnswerProblems('Hola|¡Hola!', normalizeAnswer)).toEqual([]);
  });

  test('names an empty answer and a repeat together', () => {
    expect(typedAnswerProblems('a||a', normalizeAnswer)).toEqual([
      EMPTY,
      'accepts "a" twice: each answer must differ',
    ]);
  });
});

describe('the pieces, for answers already split and decoded (inline-gap)', () => {
  test('emptyAlternativeProblems needs two or more answers to name one empty', () => {
    expect(emptyAlternativeProblems(['a', ''])).toEqual([EMPTY]);
    expect(emptyAlternativeProblems([''])).toEqual([]);
  });

  test('repeatedAlternativeProblems reports the first repeat only', () => {
    expect(repeatedAlternativeProblems(['a', 'b', 'a', 'b'], normalizeAnswer, false)).toEqual([
      'accepts "a" twice: each answer must differ',
    ]);
  });
});

describe('hasTypedAnswer', () => {
  test('is false only when the engine’s normalizing leaves nothing', () => {
    expect(hasTypedAnswer('soy', normalizeAnswer)).toBe(true);
    expect(hasTypedAnswer('  ', normalizeAnswer)).toBe(false);
    expect(hasTypedAnswer('¿?', normalizeForDictation)).toBe(false);
  });
});
