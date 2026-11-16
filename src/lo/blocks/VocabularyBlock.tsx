/**
 * VocabularyBlock — `type: "vocabulary"`. A term/gloss list, rendered as `<dl>`s: the
 * description-list element IS the semantic for "term and its definition", so no `<ul>`
 * of `<span>` pairs.
 *
 * `lang` (spec §3, WCAG 3.1.2) is per-part, not per-block: the TERM is target
 * language, its GLOSS is the UI language, so TARGET_LANG sits on a span around the term
 * text, never on the `<dt>` (whose speaker and Reveal button are UI-language chrome).
 *
 * A WORD BANK (E63, docs/specs/2026-11-12-vocabulary-word-bank-design.md). One list per
 * lesson, each word written and recorded once, shown two ways: the topic view (the
 * authored order, grouped by `topics`) and the A–Z view (the course language's order,
 * with letter headings when `options.letterHeadings`). `options.selfTest` adds Hide
 * {language} / Hide English, and a Reveal button per hidden word. Everything new is
 * off by default: a block with only `items` renders as before (W3).
 *
 * This file holds the state; the list is VocabularySections and VocabularyRow, the
 * buttons VocabularyControls, and the rules are pure modules beside them
 * (vocabulary-views, -letters, -self-test), each with its own tests.
 */
import { useReducer, useState } from 'react';
import { CircleCheck } from 'lucide-react';
import Callout from '@/components/shell/Callout';
import { TARGET_LANG } from '@/lib/lang';
import { RichText } from '../rich-text/RichText';
import type { BlockRendererProps } from './block-renderers';
import { parseBlockContent, parseBlockOptions } from './parse-block-content';
import { VocabularyBlockContentSchema } from './vocabulary-block-schema';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';
import { INITIAL_SELF_TEST, isAnyHidden, selfTestReducer } from './vocabulary-self-test';
import { nextSortMode, type VocabularySortMode } from './vocabulary-sort';
import { offersBothViews, sectionsFor, viewFor } from './vocabulary-views';
import { SelfTestButtons, ViewButtons } from './VocabularyControls';
import { VocabularySections } from './VocabularySections';

export function VocabularyBlock({
  content,
  options,
  labels,
  presentation = 'card',
}: BlockRendererProps) {
  const {
    items: authored,
    summary,
    topics,
  } = parseBlockContent('vocabulary', VocabularyBlockContentSchema, content);
  const items = authored.map((item, index) => ({ ...item, index }));
  const { selfTest, letterHeadings } = parseBlockOptions(
    'vocabulary',
    VocabularyBlockOptionsSchema,
    options,
  );
  // The topic view, nothing hidden, on the first render: the prerendered markup and
  // the first client render agree. The learner changes both with the buttons.
  const [sortMode, setSortMode] = useState<VocabularySortMode>('semantic');
  const [test, dispatch] = useReducer(selfTestReducer, INITIAL_SELF_TEST);
  const { view, sections } = sectionsFor(items, {
    mode: sortMode,
    topics,
    lang: TARGET_LANG,
    letterHeadings,
  });
  const shownIndexes = sections.flatMap((section) => section.items.map((item) => item.index));
  const showViews = offersBothViews(items);

  const choose = (pressed: 'semantic' | 'alphabetical') => {
    const next = nextSortMode(sortMode, pressed);
    // Switching view clears what was revealed; reversing the A–Z view does not.
    if (viewFor(next, items) !== view) dispatch({ type: 'switch-view' });
    setSortMode(next);
  };

  return (
    <div className="grid gap-6">
      {summary === undefined ? null : (
        // No top margin: the accordion body's own pt-2 gives the 8px this alert once
        // carried (LoAccordion, maintainer 2026-10-08).
        <Callout variant="info" title={<RichText nodes={summary.lead} />}>
          {/* The outcomes block's ticked list: semantics from <ul>/<li>, ticks aria-hidden. */}
          <ul className="mt-3 grid gap-2">
            {summary.items.map((item, index) => (
              // Static config, never reordered: the index is a stable key.
              <li key={index} className="flex items-start gap-2">
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" />
                <span className="min-w-0">
                  <RichText nodes={item} />
                </span>
              </li>
            ))}
          </ul>
        </Callout>
      )}

      {showViews || selfTest ? (
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          {showViews ? <ViewButtons sortMode={sortMode} labels={labels} onChoose={choose} /> : null}
          {selfTest ? (
            <SelfTestButtons
              hidden={test.hidden}
              labels={labels}
              onHide={(side) => dispatch({ type: 'hide', side })}
            />
          ) : null}
        </div>
      ) : null}

      <VocabularySections
        sections={sections}
        headingLevel={presentation === 'plain' ? 'h3' : 'h4'}
        letters={view === 'alphabetical'}
        test={test}
        rowClicks={!isAnyHidden(test, shownIndexes)}
        labels={labels}
        onReveal={(entry, row) => dispatch({ type: 'reveal', entry, row })}
      />
    </div>
  );
}
