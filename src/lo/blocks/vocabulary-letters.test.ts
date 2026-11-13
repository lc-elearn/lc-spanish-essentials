/**
 * vocabulary-letters.test.ts — letter headings for the A–Z view (E63, spec §4, W6).
 * Which letters share a heading is the course language's collation, at `base`
 * sensitivity: these tests PIN what the collator decides (verified with Node 22 and
 * Bun 1.3, 2026-11-12), they do not choose it. If an ICU update changes a result, the
 * test says so, and that is a decision for the maintainer, not a fix in the code.
 */
import { describe, expect, test } from 'vitest';
import { sortVocabulary } from './vocabulary-sort';
import { firstLetter, headingLetter, letterSections } from './vocabulary-letters';

/** Sections of `terms` sorted A–Z in `lang`, as [heading, terms] pairs. */
function sectionsOf(lang: string, terms: readonly string[]): [string | undefined, string[]][] {
  const sorted = sortVocabulary(
    terms.map((term) => ({ term })),
    'alphabetical',
    lang,
  );
  return letterSections(sorted, lang).map((section) => [
    section.heading,
    section.items.map((item) => item.term),
  ]);
}

describe('firstLetter', () => {
  test('is the first letter with its marks, skipping anything that is not a letter', () => {
    expect(firstLetter('о́чень')).toBe('о́');
    expect(firstLetter('(с) кем')).toBe('с');
    expect(firstLetter('ёлка')).toBe('ё');
  });
});

describe('headingLetter', () => {
  test('ru: a stress mark is removed, and the letter upper-cased', () => {
    expect(headingLetter('безнра́вственный', 'ru')).toBe('Б');
    expect(headingLetter('о́чень', 'ru')).toBe('О');
  });

  test('ru: й keeps its mark, a letter of its own; ё is filed under Е', () => {
    expect(headingLetter('йод', 'ru')).toBe('Й');
    expect(headingLetter('ёлка', 'ru')).toBe('Е');
  });

  test('a marked letter the collation treats as the base letter heads as the base letter', () => {
    expect(headingLetter('Ärger', 'de')).toBe('A');
    expect(headingLetter('être', 'fr')).toBe('E');
  });

  test('fr: an accent the collation ignores is dropped from the heading', () => {
    expect(headingLetter('école', 'fr')).toBe('E');
  });

  test('es: ñ is a letter of its own, so it stays', () => {
    expect(headingLetter('ñandú', 'es')).toBe('Ñ');
  });

  test('pl: ó is a letter of its own in Polish, so the acute stays', () => {
    expect(headingLetter('ósmy', 'pl')).toBe('Ó');
  });
});

describe('letterSections', () => {
  test('ru: stress is ignored, ё sorts and groups with е, й is its own letter', () => {
    expect(
      sectionsOf('ru', ['ёлка', 'еда', 'йод', 'игра', 'безнра́вственный', 'брак', 'аист']),
    ).toEqual([
      ['А', ['аист']],
      ['Б', ['безнра́вственный', 'брак']],
      ['Е', ['еда', 'ёлка']],
      ['И', ['игра']],
      ['Й', ['йод']],
    ]);
  });

  test('ru: a section of ё words alone is headed Е (dictionaries file ё under Е)', () => {
    expect(sectionsOf('ru', ['ёж', 'жена'])).toEqual([
      ['Е', ['ёж']],
      ['Ж', ['жена']],
    ]);
  });

  test('fr: é sorts and groups under E', () => {
    expect(sectionsOf('fr', ['fin', 'école', 'eau', 'être'])).toEqual([
      ['E', ['eau', 'école', 'être']],
      ['F', ['fin']],
    ]);
  });

  test('es: ñ is its own letter, after N', () => {
    expect(sectionsOf('es', ['oso', 'ñandú', 'nube', 'nada'])).toEqual([
      ['N', ['nada', 'nube']],
      ['Ñ', ['ñandú']],
      ['O', ['oso']],
    ]);
  });

  test('de: ä sorts and groups under A', () => {
    expect(sectionsOf('de', ['bauen', 'Ärger', 'apfel', 'Affe'])).toEqual([
      ['A', ['Affe', 'apfel', 'Ärger']],
      ['B', ['bauen']],
    ]);
  });

  test('a marked letter sorting first still heads as the base letter', () => {
    expect(sectionsOf('de', ['Ärger', 'Arm'])).toEqual([['A', ['Ärger', 'Arm']]]);
    expect(sectionsOf('fr', ['être', 'eu'])).toEqual([['E', ['être', 'eu']]]);
    expect(sectionsOf('ru', ['ёж', 'есть'])).toEqual([['Е', ['ёж', 'есть']]]);
  });

  test('a leading bracket or quote does not move an entry out of its letter section', () => {
    expect(sectionsOf('ru', ['(с) кем', 'а', 'сад', 'брак'])).toEqual([
      ['А', ['а']],
      ['Б', ['брак']],
      ['С', ['сад', '(с) кем']],
    ]);
    expect(sectionsOf('ru', ['«да»', 'дом', 'ад'])).toEqual([
      ['А', ['ад']],
      ['Д', ['«да»', 'дом']],
    ]);
  });

  test('every section has a distinct key', () => {
    const sorted = sortVocabulary(
      ['b', 'a', 'c'].map((term) => ({ term })),
      'alphabetical',
      'en',
    );
    const keys = letterSections(sorted, 'en').map((section) => section.key);
    expect(new Set(keys).size).toBe(3);
  });

  test('no entries, no sections', () => {
    expect(letterSections([], 'ru')).toEqual([]);
  });
});
