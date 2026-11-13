/**
 * vocabulary-sort.ts — the vocabulary block's Semantic | Alphabetical ordering
 * (maintainer, 2026-10-08, after french-lo-1's PhraseTable). Pure, so the view stays
 * thin and the rules are tested here.
 *
 *   - semantic      the authored order: how the lesson groups the words.
 *   - alphabetical  by the visible term in the course language, ignoring case and
 *                   accents and leading punctuation (`vocabularyCollator`).
 *   - reverse       alphabetical backwards — a second press of Alphabetical, as in
 *                   the reference.
 */
export type VocabularySortMode = 'semantic' | 'alphabetical' | 'reverse';

/**
 * The one collator for ordering and sectioning the A–Z view: `base` sensitivity, and
 * leading brackets and quotes skipped ("(с) кем" files under С), the same rule
 * `firstLetter` applies to headings, so a section is never split by the sort.
 */
export function vocabularyCollator(lang: string): Intl.Collator {
  return new Intl.Collator(lang, { sensitivity: 'base', ignorePunctuation: true });
}

/** A new list in the requested order; the authored list is never reordered. */
export function sortVocabulary<T extends { readonly term: string }>(
  items: readonly T[],
  mode: VocabularySortMode,
  lang: string,
): T[] {
  if (mode === 'semantic') return [...items];
  const collator = vocabularyCollator(lang);
  const sorted = [...items].sort((a, b) => collator.compare(a.term, b.term));
  return mode === 'reverse' ? sorted.reverse() : sorted;
}

/** The mode after pressing a button: Alphabetical toggles A→Z and Z→A. */
export function nextSortMode(
  current: VocabularySortMode,
  pressed: 'semantic' | 'alphabetical',
): VocabularySortMode {
  if (pressed === 'semantic') return 'semantic';
  return current === 'alphabetical' ? 'reverse' : 'alphabetical';
}
