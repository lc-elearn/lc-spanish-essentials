/**
 * VocabularySections — the vocabulary block's list (E63, spec §4): one `<dl>` per
 * topic or letter, each under its heading. A topic without a heading is a divider
 * (none above the first). A list with one section and no heading is today's single
 * `<dl>`, unchanged (W3).
 *
 * HEADING LEVEL FOLLOWS PRESENTATION, as in the sources block: `<h3>` in a plain block,
 * under the section's `<h2>`; `<h4>` in a card, under the accordion's `<h3>`.
 *
 * The sections share one two-column grid (subgrid), so the terms line up across topics
 * and letters as they did in one list.
 */
import type { UiStringsOverride } from '@/config/ui-strings';
import type { VocabularyItem } from './vocabulary-block-schema';
import type { VocabularySection } from './vocabulary-letters';
import type { SelfTestState } from './vocabulary-self-test';
import { VocabularyRow } from './VocabularyRow';
import './vocabulary-block.css';

/**
 * Two columns from `sm`, the term's as wide as the longest term but never more than half
 * the block: a longer term wraps. `max-content` alone let one long phrase (Russian
 * lesson 1's "относи́ться/отнести́сь (к + Dat) КАК (…)") widen the column past the
 * block, and the accordion's clipped edge cut the glosses off.
 */
const COLUMNS = 'sm:grid-cols-[fit-content(50%)_minmax(0,1fr)]';
const LIST = `grid gap-x-6 gap-y-2 ${COLUMNS}`;
/** The same columns around sections, with more room between them. */
const SECTIONS = `grid gap-x-6 gap-y-4 ${COLUMNS}`;
const HEADING = 'font-heading text-lg font-semibold text-foreground sm:col-span-2';

/** An entry with its place in the authored list: its React key. */
export type IndexedItem = VocabularyItem & { readonly index: number };

interface VocabularySectionsProps {
  sections: readonly VocabularySection<IndexedItem>[];
  headingLevel: 'h3' | 'h4';
  /** Letter headings: centred, a thin rule either side (vocabulary-block.css). */
  letters: boolean;
  test: SelfTestState;
  rowClicks: boolean;
  labels?: UiStringsOverride;
  onReveal: (entry: number, row: string) => void;
}

export function VocabularySections({
  sections,
  headingLevel: Heading,
  letters,
  ...rowProps
}: VocabularySectionsProps) {
  // Each row's place in the whole view, from 1: "Reveal Russian, word 3".
  const offsets = sections.map((_, at) =>
    sections.slice(0, at).reduce((sum, earlier) => sum + earlier.items.length, 0),
  );
  const rows = (section: VocabularySection<IndexedItem>, offset: number) =>
    section.items.map((item, at) => (
      // Keyed by the entry's place in the authored list, never its term (a plain list may
      // repeat one) nor its position (it moves when the view is sorted or reversed).
      <VocabularyRow
        key={item.index}
        item={item}
        rowKey={`${section.key}:${item.index}`}
        number={offset + at + 1}
        {...rowProps}
      />
    ));

  const [first] = sections;
  if (sections.length === 1 && first !== undefined && first.heading === undefined) {
    return <dl className={LIST}>{rows(first, 0)}</dl>;
  }
  return (
    <div className={SECTIONS}>
      {sections.map((section, index) => (
        <div key={section.key} className="grid gap-y-2 sm:col-span-2 sm:grid-cols-subgrid">
          {section.heading === undefined ? (
            index === 0 ? null : (
              <hr className="border-border sm:col-span-2" />
            )
          ) : (
            <Heading className={letters ? `vocabulary-letter ${HEADING}` : HEADING}>
              {section.heading}
            </Heading>
          )}
          <dl className="grid gap-y-2 sm:col-span-2 sm:grid-cols-subgrid">
            {rows(section, offsets[index] ?? 0)}
          </dl>
        </div>
      ))}
    </div>
  );
}
