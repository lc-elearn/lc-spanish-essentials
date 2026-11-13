/**
 * vocabulary-views.test.ts — which entries each of the word bank's two views shows,
 * and in what order (E63, spec §4). The topic view is the authored order, grouped by
 * `topics`; the A–Z view sorts in the course language and a second press reverses it.
 */
import { describe, expect, test } from 'vitest';
import {
  alphabeticalSections,
  entriesInView,
  offersBothViews,
  sectionsFor,
  topicSections,
  viewFor,
  type WordBankEntry,
} from './vocabulary-views';

const BANK: WordBankEntry[] = [
  { term: 'брак', topic: 'marriage' },
  { term: 'гражда́нский брак', topic: 'marriage', only: 'topics' },
  { term: 'развод', topic: 'attitudes' },
  { term: 'гражда́нский', only: 'alphabetical' },
  { term: 'жена', topic: 'marriage' },
];
const TOPICS = [{ id: 'marriage', heading: 'Marriage' }, { id: 'attitudes' }];

const terms = (list: readonly { term: string }[]) => list.map((item) => item.term);
const shape = (sections: readonly { heading?: string; items: readonly { term: string }[] }[]) =>
  sections.map((section) => [section.heading, terms(section.items)]);

describe('entriesInView', () => {
  test('the topic view leaves out A–Z-only entries, in written order', () => {
    expect(terms(entriesInView(BANK, 'topics'))).toEqual([
      'брак',
      'гражда́нский брак',
      'развод',
      'жена',
    ]);
  });

  test('the A–Z view leaves out topic-only entries', () => {
    expect(terms(entriesInView(BANK, 'alphabetical'))).toEqual([
      'брак',
      'развод',
      'гражда́нский',
      'жена',
    ]);
  });
});

describe('topicSections', () => {
  test('one section per topic, in topics order, entries in written order', () => {
    expect(shape(topicSections(BANK, TOPICS))).toEqual([
      ['Marriage', ['брак', 'гражда́нский брак', 'жена']],
      [undefined, ['развод']],
    ]);
  });

  test('without topics, one flat list in written order, as before E63', () => {
    expect(shape(topicSections(BANK, undefined))).toEqual([
      [undefined, ['брак', 'гражда́нский брак', 'развод', 'жена']],
    ]);
  });
});

describe('alphabeticalSections', () => {
  test('sorted in the course language, ignoring the stress mark', () => {
    expect(shape(alphabeticalSections(BANK, 'alphabetical', 'ru', false))).toEqual([
      [undefined, ['брак', 'гражда́нский', 'жена', 'развод']],
    ]);
  });

  test('reverse is the same list backwards', () => {
    expect(shape(alphabeticalSections(BANK, 'reverse', 'ru', false))).toEqual([
      [undefined, ['развод', 'жена', 'гражда́нский', 'брак']],
    ]);
  });

  test('with letter headings', () => {
    expect(shape(alphabeticalSections(BANK, 'alphabetical', 'ru', true))).toEqual([
      ['Б', ['брак']],
      ['Г', ['гражда́нский']],
      ['Ж', ['жена']],
      ['Р', ['развод']],
    ]);
  });

  test('letter headings reverse with the list, and keep their letters', () => {
    const bank = [{ term: 'еда' }, { term: 'ёлка' }, { term: 'брак' }];
    expect(shape(alphabeticalSections(bank, 'reverse', 'ru', true))).toEqual([
      ['Е', ['ёлка', 'еда']],
      ['Б', ['брак']],
    ]);
  });
});

describe('viewFor and offersBothViews', () => {
  test('Semantic shows the topic view, Alphabetical and its reverse the A–Z view', () => {
    expect(viewFor('semantic', BANK)).toBe('topics');
    expect(viewFor('alphabetical', BANK)).toBe('alphabetical');
    expect(viewFor('reverse', BANK)).toBe('alphabetical');
    expect(offersBothViews(BANK)).toBe(true);
  });

  test('a view with no entries is never shown, and the buttons go', () => {
    const azOnly: WordBankEntry[] = [
      { term: 'a', only: 'alphabetical' },
      { term: 'b', only: 'alphabetical' },
    ];
    const topicsOnly: WordBankEntry[] = [
      { term: 'a', only: 'topics' },
      { term: 'b', only: 'topics' },
    ];
    expect(viewFor('semantic', azOnly)).toBe('alphabetical');
    expect(viewFor('alphabetical', topicsOnly)).toBe('topics');
    expect(offersBothViews(azOnly)).toBe(false);
    expect(offersBothViews(topicsOnly)).toBe(false);
  });

  test('one entry offers no buttons, as before E63', () => {
    expect(offersBothViews([{ term: 'a' }])).toBe(false);
  });
});

describe('sectionsFor', () => {
  test('the topic view, then the A–Z view, from the sort mode', () => {
    const settings = { topics: TOPICS, lang: 'ru', letterHeadings: false };
    expect(sectionsFor(BANK, { ...settings, mode: 'semantic' }).view).toBe('topics');
    expect(shape(sectionsFor(BANK, { ...settings, mode: 'reverse' }).sections)).toEqual([
      [undefined, ['развод', 'жена', 'гражда́нский', 'брак']],
    ]);
  });

  test('an A–Z-only bank shows A→Z even on the semantic mode', () => {
    const azOnly: WordBankEntry[] = [
      { term: 'b', only: 'alphabetical' },
      { term: 'a', only: 'alphabetical' },
    ];
    const result = sectionsFor(azOnly, { mode: 'semantic', lang: 'en', letterHeadings: false });
    expect(result.view).toBe('alphabetical');
    expect(shape(result.sections)).toEqual([[undefined, ['a', 'b']]]);
  });
});

describe('an entry in several topics', () => {
  const MULTI: WordBankEntry[] = [
    { term: 'условия', topic: ['work', 'unemployment'] },
    { term: 'зарплата', topic: 'work' },
    { term: 'вредный', topic: ['work', 'unemployment'] },
    { term: 'пособие', topic: 'unemployment' },
  ];
  const MULTI_TOPICS = [{ id: 'work' }, { id: 'unemployment' }];

  test('the topic view shows it under each topic, in written order', () => {
    expect(shape(topicSections(MULTI, MULTI_TOPICS))).toEqual([
      [undefined, ['условия', 'зарплата', 'вредный']],
      [undefined, ['условия', 'вредный', 'пособие']],
    ]);
  });

  test('the A–Z view shows it once', () => {
    const [only] = alphabeticalSections(MULTI, 'alphabetical', 'ru', false);
    expect(terms(only?.items ?? [])).toEqual(['вредный', 'зарплата', 'пособие', 'условия']);
  });
});
