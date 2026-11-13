/**
 * parse-block-content.test.ts — a block's content and options are checked against its
 * own schema, and a failure names the block type and what broke (E63 adds options).
 */
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { parseBlockContent, parseBlockOptions } from './parse-block-content';

const Options = z.strictObject({ selfTest: z.boolean().default(false) });

describe('parseBlockContent', () => {
  test('returns the parsed content', () => {
    expect(parseBlockContent('x', z.object({ a: z.string() }), { a: 'b' })).toEqual({ a: 'b' });
  });

  test('throws naming the type', () => {
    expect(() => parseBlockContent('x', z.object({ a: z.string() }), {})).toThrow(
      /block type "x" has invalid content/,
    );
  });
});

describe('parseBlockOptions', () => {
  test('absent options take every default', () => {
    expect(parseBlockOptions('vocabulary', Options, undefined)).toEqual({ selfTest: false });
  });

  test('given options are parsed', () => {
    expect(parseBlockOptions('vocabulary', Options, { selfTest: true })).toEqual({
      selfTest: true,
    });
  });

  test('a bad option throws naming the type and the key', () => {
    expect(() => parseBlockOptions('vocabulary', Options, { selfTset: true })).toThrow(
      /block type "vocabulary" has invalid options[\s\S]*selfTset/,
    );
  });
});
