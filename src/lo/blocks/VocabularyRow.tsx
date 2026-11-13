/**
 * VocabularyRow — one entry of the vocabulary block: the term, in the course language,
 * with its clip, and its gloss (E63 splits it out of VocabularyBlock.tsx).
 *
 * The speaker sits inside the `<dt>` and BEFORE the word. Inside, because a control in
 * a column of its own is separated from the thing it plays for anyone navigating by
 * element. Before, because it gives every row one shared left edge to scan down and
 * click, and because a vocabulary list is heard before it is read.
 *
 * SELF-TEST (spec §5). A hidden word stays only as an invisible, `aria-hidden`
 * placeholder (`visibility: hidden` also keeps it out of find-in-page), so assistive
 * technology cannot read it early while it still holds the column's width; the Reveal
 * button, named for its slot ("Reveal Russian, word 3"), sits in the same grid cell. The revealed word takes focus. While the term is
 * hidden its speaker is "Listen: word 3", not "Listen: брак". `lang` sits on a span
 * around the term text only, never on the `<dt>`: the speaker's name and the Reveal
 * button are English chrome, and `lang` is for target-language text only (§6).
 */
import { useEffect, useRef } from 'react';
import { playRowClip, ROW_CLIP_CLASSES } from '@/audio/row-clip';
import { AudioClip } from '@/components/audio/AudioClip';
import { buttonVariants } from '@/components/ui/button';
import { fillLabel, resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import { TARGET_LANG } from '@/lib/lang';
import type { IndexedItem } from './VocabularySections';
import {
  isHidden,
  LANGUAGE_NAMES,
  type HideSide,
  type SelfTestState,
} from './vocabulary-self-test';

/** The word (or gloss) just revealed: focusable from script only, and focused once, on mount. */
function RevealedWord({ text, lang }: { text: string; lang?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <span
      ref={ref}
      tabIndex={-1}
      lang={lang}
      className="rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {text}
    </span>
  );
}

interface VocabularyRowProps {
  item: IndexedItem;
  /** This row's identity in the view: a word under two topics has two rows. */
  rowKey: string;
  /** The entry's place in the view, from 1: how a hidden word is named ("word 3"). */
  number: number;
  test: SelfTestState;
  /** False while any word in the block is hidden, so a click never both plays and reveals (W8). */
  rowClicks: boolean;
  labels?: UiStringsOverride;
  onReveal: (entry: number, row: string) => void;
}

export function VocabularyRow({
  item,
  rowKey,
  number,
  test,
  rowClicks,
  labels,
  onReveal,
}: VocabularyRowProps) {
  const termHidden = isHidden(test, item.index, 'target');
  const glossHidden = isHidden(test, item.index, 'native');
  const focusSide = test.lastRow === rowKey ? test.hidden : 'none';
  const plays = item.audio !== undefined && rowClicks;

  const cell = (side: HideSide, text: string, hidden: boolean) => {
    if (hidden) {
      // The word stays, invisible and aria-hidden, in the same grid cell as the Reveal
      // button, so the cell keeps the word's width and the other column does not jump.
      return (
        <span className="vocabulary-hidden-word">
          <span aria-hidden="true" className="invisible">
            {text}
          </span>
          <button
            type="button"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
            aria-label={fillLabel(resolveLabel('vocabularyRevealWord', labels), {
              language: LANGUAGE_NAMES[side],
              number,
            })}
            onClick={() => onReveal(item.index, rowKey)}
          >
            {resolveLabel('vocabularyReveal', labels)}
          </button>
        </span>
      );
    }
    // `lang` only on the course-language side: the gloss is the page's own language.
    const lang = side === 'target' ? TARGET_LANG : undefined;
    if (focusSide === side) return <RevealedWord text={text} lang={lang} />;
    return side === 'native' ? text : <span lang={lang}>{text}</span>;
  };

  return (
    // THE WHOLE ROW PLAYS THE CLIP, and it is a MOUSE affordance only — no role, no
    // tabIndex, no key handler: the speaker inside is the keyboard path (E62). Only a
    // row WITH a clip gets the cursor and the hover, and none while a word is hidden.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- pointer-only enhancement (mouse and touch) over the speaker <button>, which is the keyboard path; see src/audio/row-clip.ts
    <div
      onClick={plays ? playRowClip : undefined}
      data-row-clip={plays ? '' : undefined}
      className={`grid gap-x-6 rounded-md sm:col-span-2 sm:grid-cols-subgrid ${
        plays ? ROW_CLIP_CLASSES : ''
      }`}
    >
      <dt className="flex items-center gap-2 font-medium text-foreground">
        {item.audio === undefined ? null : (
          // `title` is the speaker's accessible name: "play" alone would be the same on
          // every row, and a hidden term must not be spoken in it.
          <AudioClip
            className="super-compact-speaker"
            inline
            soundFile={item.audio}
            title={
              termHidden
                ? fillLabel(resolveLabel('vocabularyListenWord', labels), { number })
                : fillLabel(resolveLabel('vocabularyListen', labels), { term: item.term })
            }
          />
        )}
        {cell('target', item.term, termHidden)}
      </dt>
      {/* Centred like the term, which sits beside a 54px speaker. */}
      <dd className="self-center text-muted-foreground">
        {cell('native', item.gloss, glossHidden)}
      </dd>
    </div>
  );
}
