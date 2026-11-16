/**
 * vocabulary-letters.ts — letter headings for the vocabulary block's A–Z view (E63,
 * spec §4, W6). Pure, so the per-language rules are tested here, not through a view.
 *
 * WHICH LETTERS SHARE A HEADING IS THE COLLATOR'S DECISION, never "first character,
 * upper-cased". A new section starts wherever an entry's first letter compares unequal
 * (`Intl.Collator`, `base` sensitivity, the course language) to the previous entry's.
 * So Russian ё joins е and й stands alone, French é joins e, Spanish ñ stands alone
 * after n, German ä joins a — whatever the language's collation says (the tests pin it).
 *
 * The HEADING is the section's first letter, upper-cased for the course language, with
 * every mark removed where the collator says the marked and unmarked letters are the
 * same letter: Russian "о́" and "ё" head "О" and "Е", French "é" and German "ä" head "E"
 * and "A", but Polish "ó", Spanish "ñ" and Russian "й", letters of their own, keep theirs.
 */

import { vocabularyCollator } from './vocabulary-sort';

/** One run of entries under an optional heading: a topic, or a letter. */
export interface VocabularySection<T> {
  /** Stable and unique within one list: the React key. */
  readonly key: string;
  readonly heading?: string;
  readonly items: readonly T[];
}

const MARKS = /\p{M}/gu;

/**
 * The first letter of a term with its combining marks, composed (NFC). Anything before
 * it that is not a letter (a bracket, a quote) is skipped: "(с) кем" → "с".
 */
export function firstLetter(term: string): string {
  const decomposed = term.normalize('NFD');
  const letter = /\p{L}\p{M}*/u.exec(decomposed)?.[0] ?? Array.from(decomposed)[0] ?? '';
  return letter.normalize('NFC');
}

/** The heading a section starting with `term` shows, in `lang`. */
export function headingLetter(term: string, lang: string): string {
  const letter = firstLetter(term);
  const bare = letter.normalize('NFD').replace(MARKS, '').normalize('NFC');
  const sameLetter = vocabularyCollator(lang).compare(letter, bare) === 0;
  return (sameLetter ? bare : letter).toLocaleUpperCase(lang);
}

/**
 * Splits a list ALREADY SORTED A→Z into letter sections. A reversed view reverses the
 * sections this returns (vocabulary-views.ts), so a heading is the same both ways.
 */
export function letterSections<T extends { readonly term: string }>(
  sorted: readonly T[],
  lang: string,
): VocabularySection<T>[] {
  const collator = vocabularyCollator(lang);
  return sorted.reduce<VocabularySection<T>[]>((sections, item, index) => {
    const previous = sorted[index - 1];
    const last = sections.at(-1);
    const sameLetter =
      previous !== undefined &&
      collator.compare(firstLetter(previous.term), firstLetter(item.term)) === 0;
    if (sameLetter && last !== undefined) {
      return [...sections.slice(0, -1), { ...last, items: [...last.items, item] }];
    }
    const heading = headingLetter(item.term, lang);
    return [...sections, { key: `letter-${sections.length}-${heading}`, heading, items: [item] }];
  }, []);
}
