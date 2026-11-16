/**
 * exercise-schemas.test.ts — the type → schema registry the LO assembler validates
 * every exercise with (review 2026-10-21, concern 1).
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EXERCISE_TYPE_KEYS, type ExerciseType } from '@/config/exercise-types';
import { SHOWCASE_FIXTURES } from '@/showcase/fixtures';
import {
  EXERCISE_CONFIG_SCHEMAS,
  exerciseConfigSchema,
  withClosedOptions,
} from './exercise-schemas';

describe('EXERCISE_CONFIG_SCHEMAS', () => {
  it('has exactly one schema per canonical exercise type', () => {
    expect(Object.keys(EXERCISE_CONFIG_SCHEMAS).sort()).toEqual([...EXERCISE_TYPE_KEYS].sort());
  });

  it.each(SHOWCASE_FIXTURES.map((fixture) => [fixture.id, fixture] as const))(
    'accepts the %s showcase fixture',
    (_id, fixture) => {
      const result = exerciseConfigSchema(fixture.type).safeParse(fixture.config);
      expect(result.error?.issues ?? []).toEqual([]);
    },
  );

  it.each(EXERCISE_TYPE_KEYS)('pins %s to its own type', (type) => {
    const fixture = SHOWCASE_FIXTURES.find((entry) => entry.type === type);
    const other = EXERCISE_TYPE_KEYS.find((key) => key !== type);
    const config = { ...(fixture?.config as object), type: other };
    expect(exerciseConfigSchema(type).safeParse(config).success).toBe(false);
  });

  it.each(EXERCISE_TYPE_KEYS)('refuses %s with empty content', (type) => {
    expect(exerciseConfigSchema(type).safeParse({ type, content: {} }).success).toBe(false);
  });
});

// Maintainer, 2026-11-11 (E59): an option key no engine knows is a typo, so it fails at
// load, naming the key, instead of being ignored. Only at load: each engine's own schema,
// which it re-parses at render, stays tolerant.
describe('exerciseConfigSchema options', () => {
  /** The type's showcase fixture with these extra `options` merged in. */
  const withOptions = (type: ExerciseType, extra: object): unknown => {
    const fixture = SHOWCASE_FIXTURES.find((entry) => entry.type === type);
    const config = fixture?.config as { options?: object } | undefined;
    return { ...config, options: { ...config?.options, ...extra } };
  };

  it.each(EXERCISE_TYPE_KEYS)('refuses an unknown option key on %s, naming it', (type) => {
    const result = exerciseConfigSchema(type).safeParse(withOptions(type, { shufle: true }));
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: 'unrecognized_keys', keys: ['shufle'], path: ['options'] }),
    ]);
  });

  it('accepts the options flashcards adds to the shared ones', () => {
    const own = { srs: true, direction: 'native-target', lockDirection: true, shuffle: true };
    const result = exerciseConfigSchema('flashcards').safeParse(withOptions('flashcards', own));
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('refuses a deck option on another engine (copied from a deck, say)', () => {
    const result = exerciseConfigSchema('select').safeParse(withOptions('select', { srs: true }));
    expect(result.error?.issues).toEqual([
      expect.objectContaining({ code: 'unrecognized_keys', keys: ['srs'], path: ['options'] }),
    ]);
  });

  // CONTRIBUTING, "Exercise options": an engine ignores a shared field it has no use for,
  // so closing `options` must not refuse one on any engine.
  it.each(EXERCISE_TYPE_KEYS)('accepts every shared option on %s', (type) => {
    const shared = {
      shuffle: true,
      sampleSize: 1,
      allowShowAnswers: false,
      showAnswersAfter: 2,
      caseSensitive: true,
    };
    const result = exerciseConfigSchema(type).safeParse(withOptions(type, shared));
    expect(result.error?.issues ?? []).toEqual([]);
  });

  it('names the type when an engine schema has no optional options object', () => {
    const schema = z.object({ type: z.literal('select'), options: z.object({}) });
    expect(() => withClosedOptions('select', schema)).toThrow(/the select schema's `options`/);
  });

  it.each(EXERCISE_TYPE_KEYS)("leaves %s's own schema tolerant, for its render", (type) => {
    const config = withOptions(type, { shufle: true });
    expect(EXERCISE_CONFIG_SCHEMAS[type].safeParse(config).error?.issues ?? []).toEqual([]);
  });
});
