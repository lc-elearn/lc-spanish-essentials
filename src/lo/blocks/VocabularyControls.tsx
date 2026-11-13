/**
 * VocabularyControls — the vocabulary block's two button groups (E63, spec §4–5):
 * the view buttons (Semantic | Alphabetical, french-lo-1's PhraseTable) and the
 * self-test's Hide {language} | Hide English. Every button is a toggle with
 * `aria-pressed` and a name that never changes; the pressed one is filled.
 *
 * Native buttons styled by buttonVariants: the Button component would pull Base UI's
 * primitive into main-*.js, over the JS budget (docs/TOOLING.md).
 */
import { ArrowDownAZ, ArrowUpZA, EyeOff, Layers } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { fillLabel, resolveLabel, type UiStringsOverride } from '@/config/ui-strings';
import { LANGUAGE_NAMES, type HideSide, type SelfTestState } from './vocabulary-self-test';
import type { VocabularySortMode } from './vocabulary-sort';

const toggleClass = (pressed: boolean): string =>
  buttonVariants({ variant: pressed ? 'default' : 'outline', size: 'lg' });

interface ViewButtonsProps {
  sortMode: VocabularySortMode;
  labels?: UiStringsOverride;
  onChoose: (pressed: 'semantic' | 'alphabetical') => void;
}

/** Semantic | Alphabetical. A second press of Alphabetical reverses the order (Z→A). */
export function ViewButtons({ sortMode, labels, onChoose }: ViewButtonsProps) {
  const isAlphabetical = sortMode !== 'semantic';
  const AlphabeticalIcon = sortMode === 'reverse' ? ArrowUpZA : ArrowDownAZ;
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={resolveLabel('vocabularyViews', labels)}
    >
      <button
        type="button"
        className={toggleClass(!isAlphabetical)}
        aria-pressed={!isAlphabetical}
        onClick={() => onChoose('semantic')}
      >
        <Layers aria-hidden="true" />
        {resolveLabel('vocabularySemantic', labels)}
      </button>
      <button
        type="button"
        className={toggleClass(isAlphabetical)}
        aria-pressed={isAlphabetical}
        onClick={() => onChoose('alphabetical')}
      >
        <AlphabeticalIcon aria-hidden="true" />
        {resolveLabel('vocabularyAlphabetical', labels)}
      </button>
    </div>
  );
}

const SIDES: readonly HideSide[] = ['target', 'native'];

interface SelfTestButtonsProps {
  hidden: SelfTestState['hidden'];
  labels?: UiStringsOverride;
  onHide: (side: HideSide) => void;
}

/** Hide {language} | Hide English: either/or (W7), so pressing one releases the other. */
export function SelfTestButtons({ hidden, labels, onHide }: SelfTestButtonsProps) {
  const hide = resolveLabel('vocabularyHide', labels);
  return (
    <div
      className="flex flex-wrap gap-2"
      role="group"
      aria-label={resolveLabel('vocabularySelfTest', labels)}
    >
      {SIDES.map((side) => (
        <button
          key={side}
          type="button"
          className={toggleClass(hidden === side)}
          aria-pressed={hidden === side}
          onClick={() => onHide(side)}
        >
          <EyeOff aria-hidden="true" />
          {fillLabel(hide, { language: LANGUAGE_NAMES[side] })}
        </button>
      ))}
    </div>
  );
}
