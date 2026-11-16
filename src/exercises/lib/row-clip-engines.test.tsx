// @vitest-environment happy-dom
/**
 * row-clip-engines.test.tsx — in every exercise whose rows carry their own clip, a click
 * on the row's text plays it, a click on the row's own control does not, and a row with
 * no clip of its own is left alone (E62).
 * Spec: docs/specs/2026-11-12-row-click-audio-design.md §5–6.
 */
import { act, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ROW_CLIP_ROW_SELECTOR } from '@/audio/row-clip';
import type { ExerciseComponentProps } from '@/exercises/lazy-registry';
import DictationExercise from '@/exercises/dictation/DictationExercise';
import { dictationFixtures } from '@/exercises/dictation/dictation.fixture';
import DragFillGapsExercise from '@/exercises/drag-fill-gaps/DragFillGapsExercise';
import InlineTypedGapExercise from '@/exercises/inline-gap/InlineTypedGapExercise';
import { inlineGapFixtures } from '@/exercises/inline-gap/inline-gap.fixture';
import LineMatchExercise from '@/exercises/line-match/LineMatchExercise';
import PhraseReorderExercise from '@/exercises/phrase-reorder/PhraseReorderExercise';
import { phraseReorderFixtures } from '@/exercises/phrase-reorder/phrase-reorder.fixture';
import WordSpotExercise from '@/exercises/word-spot/WordSpotExercise';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

const CLIP = 'audio/showcase-demo/inline-gap/q1.wav';

const fixture = (list: readonly { id: string; config: unknown }[], id: string): unknown => {
  const found = list.find((entry) => entry.id === id);
  if (found === undefined) throw new Error(`no fixture ${id}`);
  return found.config;
};

/**
 * A copy of `config` whose LAST item/row has no `audio`: the fixture's other rows keep
 * theirs, so the copy has clip rows and one row without.
 */
function dropLastAudio(config: unknown): unknown {
  const copy = structuredClone(config) as {
    content: { items?: { audio?: string }[]; rows?: { audio?: string }[] };
  };
  const list = copy.content.items ?? copy.content.rows;
  const last = list?.at(-1);
  if (last === undefined) throw new Error('config has no last item to strip');
  delete last.audio;
  return copy;
}

/**
 * [name, engine, config, selector of the control inside a row that must NOT play,
 *  config with a last row that has no clip, or null when the schema forbids that]
 */
type Case = [string, ComponentType<ExerciseComponentProps>, unknown, string, unknown];

const inlineAudio = fixture(inlineGapFixtures, 'inline-gap-audio');
const inlineMaster = fixture(inlineGapFixtures, 'inline-gap-master');
const phraseReorder = phraseReorderFixtures[0]?.config;

const dragFill = {
  type: 'drag-fill-gaps',
  content: {
    items: [{ text: 'Yo [soy] y ella [vive].', audio: CLIP }, { text: 'Tú [eres] de [aquí].' }],
  },
};
const wordSpot = {
  type: 'word-spot',
  content: {
    items: [{ text: 'El [ch]ico [ch]ileno.', audio: CLIP }, { text: 'La [ll]uvia.' }],
  },
};
const lineMatch = {
  type: 'line-match',
  content: {
    items: [
      {
        id: 'a',
        label: 'el círculo',
        image: 'images/line-match/circle.svg',
        localLanguage: 'circle',
        audio: CLIP,
      },
      {
        id: 'b',
        label: 'el cuadrado',
        image: 'images/line-match/square.svg',
        localLanguage: 'square',
        audio: CLIP,
      },
      {
        id: 'c',
        label: 'el triángulo',
        image: 'images/line-match/triangle.svg',
        localLanguage: 'triangle',
      },
    ],
  },
};

const CASES: Case[] = [
  [
    'inline-gap, independent clips',
    InlineTypedGapExercise,
    inlineAudio,
    'input',
    dropLastAudio(inlineAudio),
  ],
  [
    'inline-gap, master playlist',
    InlineTypedGapExercise,
    inlineMaster,
    'input',
    dropLastAudio(inlineMaster),
  ],
  // The dictation schema requires audio on every row, so there is no row without one to
  // check here; TextEntryRuntime's clip-less branch is the same `row.audio ?` ternary.
  ['text-entry (dictation)', DictationExercise, dictationFixtures[0]?.config, 'input', null],
  [
    'phrase-reorder',
    PhraseReorderExercise,
    phraseReorder,
    'button:not([data-row-clip-speaker])',
    dropLastAudio(phraseReorder),
  ],
  [
    'drag-fill-gaps',
    DragFillGapsExercise,
    dragFill,
    'button:not([data-row-clip-speaker])',
    dragFill,
  ],
  ['word-spot', WordSpotExercise, wordSpot, 'button:not([data-row-clip-speaker])', wordSpot],
  [
    'line-match (phone layout)',
    LineMatchExercise,
    lineMatch,
    '[role="combobox"], button:not([data-row-clip-speaker])',
    lineMatch,
  ],
];

function mount(Engine: ComponentType<ExerciseComponentProps>, config: unknown): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Engine config={config as ExerciseComponentProps['config']} />));
  return container;
}

function firstRow(container: HTMLElement) {
  const row = container.querySelector<HTMLElement>(ROW_CLIP_ROW_SELECTOR);
  if (row === null) throw new Error('no clip row rendered');
  const played = vi.fn();
  row.querySelector('[data-row-clip-speaker]')?.addEventListener('click', played);
  return { row, played };
}

/** An element in the row that is neither a control nor inside one: plain row text. */
function plainRowChild(row: HTMLElement): HTMLElement {
  const child = [...row.querySelectorAll<HTMLElement>('*')].find(
    (el) =>
      el.closest('button, input, select, textarea, label, [role], [draggable="true"]') === null,
  );
  if (child === undefined) throw new Error('no non-control element inside the row');
  return child;
}

/** A row that sits beside a clip row but has no `data-row-clip` of its own. */
function rowWithoutClip(container: HTMLElement): HTMLElement {
  const { row } = firstRow(container);
  const sibling = [...(row.parentElement?.children ?? [])].find(
    (el): el is HTMLElement =>
      el instanceof HTMLElement && el.tagName === row.tagName && !el.matches(ROW_CLIP_ROW_SELECTOR),
  );
  if (sibling === undefined) throw new Error('no row without a clip beside the clip row');
  return sibling;
}

describe.each(CASES)('%s', (_name, Engine, config, controlSelector, configWithoutClip) => {
  test('a click on the row text presses its speaker', () => {
    const { row, played } = firstRow(mount(Engine, config));
    act(() => plainRowChild(row).click());
    expect(played).toHaveBeenCalledTimes(1);
  });

  test("a click on the row's own control does not play", () => {
    const { row, played } = firstRow(mount(Engine, config));
    const control = row.querySelector<HTMLElement>(controlSelector);
    if (control === null) throw new Error(`no ${controlSelector} in the row`);
    act(() => control.click());
    expect(played).not.toHaveBeenCalled();
  });

  test.skipIf(configWithoutClip === null)(
    'a row without a clip gets no marker and no pointer cursor',
    () => {
      const plain = rowWithoutClip(mount(Engine, configWithoutClip));
      expect(plain.hasAttribute('data-row-clip')).toBe(false);
      expect(plain.classList.contains('cursor-pointer')).toBe(false);
    },
  );
});
