/**
 * vocabulary-block-schema.test.ts — the word bank's content contract (E63, spec §3):
 * one list of entries, each in the topic view, the A–Z view or both, and the six ways
 * a word bank fails the build, each with a message naming the entry.
 */
import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { VocabularyBlockContentSchema } from './vocabulary-block-schema';

const TOPICS = [{ id: 'marriage', heading: 'Marriage' }, { id: 'attitudes' }];

/** The parse error as an author reads it, or '' when the content is valid. */
function errorFor(content: unknown): string {
  const result = VocabularyBlockContentSchema.safeParse(content);
  return result.success ? '' : z.prettifyError(result.error);
}

describe('valid word banks', () => {
  test('a plain list, as every course has today, still parses', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage' }] })).toBe('');
  });

  test('topics, topic and only parse', () => {
    const parsed = VocabularyBlockContentSchema.parse({
      topics: TOPICS,
      items: [
        { term: 'брак', gloss: 'marriage', topic: 'marriage' },
        { term: 'гражда́нский брак', gloss: 'civil partnership', topic: 'marriage', only: 'topics' },
        { term: 'гражда́нский', gloss: 'civil', only: 'alphabetical' },
        { term: 'развод', gloss: 'divorce', topic: 'attitudes' },
      ],
    });
    expect(parsed.topics).toEqual(TOPICS);
    expect(parsed.items.map((item) => item.only)).toEqual([
      undefined,
      'topics',
      'alphabetical',
      undefined,
    ]);
  });

  test('without topics, an entry needs no topic', () => {
    expect(
      errorFor({
        items: [
          { term: 'брак', gloss: 'marriage', only: 'topics' },
          { term: 'гражданский', gloss: 'civil', only: 'alphabetical' },
        ],
      }),
    ).toBe('');
  });
});

describe('the build fails on', () => {
  test('1. a topic not declared in topics', () => {
    expect(
      errorFor({
        topics: TOPICS,
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marrige' },
          { term: 'развод', gloss: 'divorce', topic: 'attitudes' },
          { term: 'жена', gloss: 'wife', topic: 'marriage' },
        ],
      }),
    ).toMatch(
      /items\[0\] "брак": topic "marrige" is not declared in "topics" \(declared: marriage, attitudes\)/,
    );
  });

  test('1. a topic when no topics are declared at all', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }] })).toMatch(
      /items\[0\] "брак": topic "marriage" is not declared in "topics"/,
    );
  });

  test('2. topics declared and a topic-view entry with no topic', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }],
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marriage' },
          { term: 'жена', gloss: 'wife' },
        ],
      }),
    ).toMatch(/items\[1\] "жена" shows in the topic view but has no "topic"/);
  });

  test('2. …but an A–Z-only entry needs none', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }],
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marriage' },
          { term: 'жена', gloss: 'wife', only: 'alphabetical' },
        ],
      }),
    ).toBe('');
  });

  test('3. a declared topic no entry uses', () => {
    expect(
      errorFor({ topics: TOPICS, items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }] }),
    ).toMatch(/topic "attitudes" is declared but no entry uses it/);
  });

  test('4. a topic together with "only": "alphabetical"', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }],
        items: [
          { term: 'брак', gloss: 'marriage', topic: 'marriage' },
          { term: 'жена', gloss: 'wife', topic: 'marriage', only: 'alphabetical' },
        ],
      }),
    ).toMatch(/items\[1\] "жена" has a topic but "only": "alphabetical"/);
  });

  test('5. the same term twice in a word bank, compared after Unicode normalisation', () => {
    // A word bank is a block with `topics` or an `only`; "й" precomposed, then as и + breve.
    expect(
      errorFor({
        items: [
          { term: 'мой', gloss: 'my', only: 'topics' },
          { term: 'мой', gloss: 'mine' },
        ],
      }),
    ).toMatch(/items\[1\] "мой" repeats items\[0\]/);
    expect(
      errorFor({
        topics: [{ id: 'a' }],
        items: [
          { term: 'мой', gloss: 'my', topic: 'a' },
          { term: 'мой', gloss: 'mine', topic: 'a' },
        ],
      }),
    ).toMatch(/items\[1\] "мой" repeats items\[0\]/);
  });

  test('5. but a plain list may repeat a term, as before the word bank (2015 units)', () => {
    expect(
      errorFor({
        items: [
          { term: 'условия', gloss: 'conditions' },
          { term: 'условия', gloss: 'conditions' },
        ],
      }),
    ).toBe('');
  });

  test('6. an only value other than "topics" or "alphabetical"', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage', only: 'semantic' }] })).toMatch(
      /items\[0\]\.only/,
    );
  });

  test('6. …and the message names the entry and the allowed values', () => {
    expect(errorFor({ items: [{ term: 'брак', gloss: 'marriage', only: 'semantic' }] })).toMatch(
      /entry "брак".*"only".*"topics".*"alphabetical"/,
    );
  });

  test('an unknown key (a misspelt "only") fails the build, naming the key and the entry', () => {
    const message = errorFor({ items: [{ term: 'брак', gloss: 'marriage', onyl: 'topics' }] });
    expect(message).toMatch(/onyl/);
    expect(message).toMatch(/"брак"/);
  });

  test('a topic id declared twice', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage' }, { id: 'marriage' }],
        items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }],
      }),
    ).toMatch(/topic "marriage" is declared twice/);
  });

  test('an empty topics array', () => {
    expect(errorFor({ topics: [], items: [{ term: 'брак', gloss: 'marriage' }] })).not.toBe('');
  });

  test('a misspelt key in a topic', () => {
    expect(
      errorFor({
        topics: [{ id: 'marriage', haeding: 'Marriage' }],
        items: [{ term: 'брак', gloss: 'marriage', topic: 'marriage' }],
      }),
    ).toMatch(/haeding/);
  });
});

describe('an entry in several topics (maintainer 2026-11-13, 2015 units 2 and 9)', () => {
  const items = (topic: unknown) => [
    { term: 'условия', gloss: 'conditions', topic },
    { term: 'брак', gloss: 'marriage', topic: 'attitudes' },
  ];

  test('topic is a string or a list of ids', () => {
    expect(errorFor({ topics: TOPICS, items: items('marriage') })).toBe('');
    expect(errorFor({ topics: TOPICS, items: items(['marriage', 'attitudes']) })).toBe('');
  });

  test('an undeclared id in the list names the entry and the id', () => {
    expect(errorFor({ topics: TOPICS, items: items(['marriage', 'marrige']) })).toMatch(
      /items\[0\] "условия": topic "marrige" is not declared/,
    );
  });

  test('an id listed twice in one entry fails', () => {
    expect(errorFor({ topics: TOPICS, items: items(['marriage', 'marriage']) })).toMatch(
      /items\[0\] "условия".*"marriage" twice/,
    );
  });

  test('an empty list fails', () => {
    const message = errorFor({ topics: [{ id: 'attitudes' }], items: items([]) });
    expect(message).toMatch(/items\[0\] "условия": "topic" is an empty list — give one id or more/);
    // No misleading follow-ons from the same mistake.
    expect(message).not.toMatch(/has no "topic"|no entry uses/);
  });

  test('a declared topic used only as a second membership counts as used', () => {
    expect(errorFor({ topics: TOPICS, items: items(['marriage', 'attitudes']).slice(0, 1) })).toBe(
      '',
    );
  });

  test('a topic with only "alphabetical" still fails, listed or not', () => {
    expect(
      errorFor({
        topics: TOPICS,
        items: [{ term: 'x', gloss: 'x', topic: ['marriage', 'attitudes'], only: 'alphabetical' }],
      }),
    ).toMatch(/has a topic but "only": "alphabetical"/);
  });
});
