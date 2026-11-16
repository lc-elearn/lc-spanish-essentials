/**
 * vocabulary-views.ts — the word bank's two views (E63, spec §4). Pure, so which entry
 * shows where, and in what order, is tested here and the view stays thin.
 *
 *   - topics        the authored order, grouped by `topics` when the block declares
 *                   them; entries marked `"only": "alphabetical"` are left out.
 *   - alphabetical  sorted in the course language (vocabulary-sort.ts), optionally under
 *                   letter headings (vocabulary-letters.ts); entries marked
 *                   `"only": "topics"` are left out. The `reverse` sort mode shows it Z→A.
 *
 * A view with no entries is never shown: the other one is, and the buttons are not
 * offered (`offersBothViews`).
 */
import { letterSections, type VocabularySection } from './vocabulary-letters';
import { sortVocabulary, type VocabularySortMode } from './vocabulary-sort';

export type VocabularyView = 'topics' | 'alphabetical';

/** What the views need from an entry: the schema's item, narrowed. */
export interface WordBankEntry {
  readonly term: string;
  /** One topic id, or several: the entry shows under each in the topic view. */
  readonly topic?: string | readonly string[];
  readonly only?: VocabularyView;
}

/** What the views need from a topic. */
interface WordBankTopic {
  readonly id: string;
  readonly heading?: string;
}

/** The topic ids an entry belongs to, in written order (none when it has no topic). */
export function topicIds(item: { readonly topic?: string | readonly string[] }): readonly string[] {
  if (item.topic === undefined) return [];
  return typeof item.topic === 'string' ? [item.topic] : item.topic;
}

/** The entries `view` shows, in written order. */
export function entriesInView<T extends WordBankEntry>(
  items: readonly T[],
  view: VocabularyView,
): T[] {
  return items.filter((item) => item.only === undefined || item.only === view);
}

/** Whether to offer the view buttons: two or more entries, and both views have some. */
export function offersBothViews(items: readonly WordBankEntry[]): boolean {
  return (
    items.length >= 2 &&
    entriesInView(items, 'topics').length > 0 &&
    entriesInView(items, 'alphabetical').length > 0
  );
}

/** The view a sort mode shows; when one view would be empty, always the other. */
export function viewFor(mode: VocabularySortMode, items: readonly WordBankEntry[]): VocabularyView {
  if (entriesInView(items, 'topics').length === 0) return 'alphabetical';
  if (entriesInView(items, 'alphabetical').length === 0) return 'topics';
  return mode === 'semantic' ? 'topics' : 'alphabetical';
}

/** The topic view: one section per topic, or one flat section without `topics`. */
export function topicSections<T extends WordBankEntry>(
  items: readonly T[],
  topics: readonly WordBankTopic[] | undefined,
): VocabularySection<T>[] {
  const shown = entriesInView(items, 'topics');
  if (topics === undefined) return [{ key: 'all', items: shown }];
  return topics.map((topic) => ({
    key: `topic-${topic.id}`,
    ...(topic.heading === undefined ? {} : { heading: topic.heading }),
    items: shown.filter((item) => topicIds(item).includes(topic.id)),
  }));
}

/**
 * The A–Z view. Sections are cut from the A→Z order and then reversed, entries and
 * sections both, so a letter heading reads the same in either direction.
 */
export function alphabeticalSections<T extends WordBankEntry>(
  items: readonly T[],
  order: 'alphabetical' | 'reverse',
  lang: string,
  letterHeadings: boolean,
): VocabularySection<T>[] {
  const sorted = sortVocabulary(entriesInView(items, 'alphabetical'), 'alphabetical', lang);
  const sections = letterHeadings ? letterSections(sorted, lang) : [{ key: 'all', items: sorted }];
  if (order === 'alphabetical') return sections;
  return [...sections].reverse().map((section) => ({
    ...section,
    items: [...section.items].reverse(),
  }));
}

interface ViewSettings {
  readonly mode: VocabularySortMode;
  readonly topics?: readonly WordBankTopic[];
  readonly lang: string;
  readonly letterHeadings: boolean;
}

/** The view to show for `settings`, and its sections. */
export function sectionsFor<T extends WordBankEntry>(
  items: readonly T[],
  settings: ViewSettings,
): { view: VocabularyView; sections: VocabularySection<T>[] } {
  const view = viewFor(settings.mode, items);
  if (view === 'topics') return { view, sections: topicSections(items, settings.topics) };
  const order = settings.mode === 'reverse' ? 'reverse' : 'alphabetical';
  return {
    view,
    sections: alphabeticalSections(items, order, settings.lang, settings.letterHeadings),
  };
}
