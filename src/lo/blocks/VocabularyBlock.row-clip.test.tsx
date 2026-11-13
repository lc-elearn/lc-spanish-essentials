// @vitest-environment happy-dom
/**
 * VocabularyBlock.row-clip.test.tsx — a click on a row with a clip presses its speaker
 * through the shared helper (E62); a row without a clip is not a row-clip row.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { ROW_CLIP_ROW_SELECTOR } from '@/audio/row-clip';
import { VocabularyBlock } from './VocabularyBlock';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <VocabularyBlock
        content={{
          items: [
            { term: 'la casa', gloss: 'the house', audio: 'audio/lo-00-example/placeholder.m4a' },
            { term: 'el perro', gloss: 'the dog' },
          ],
        }}
      />,
    ),
  );
  return container;
}

test('a click on the gloss presses the row speaker', () => {
  const container = mount();
  const rows = container.querySelectorAll(ROW_CLIP_ROW_SELECTOR);
  expect(rows).toHaveLength(1);
  const row = rows[0] as HTMLElement;
  const played = vi.fn();
  row.querySelector('[data-row-clip-speaker]')?.addEventListener('click', played);

  act(() => (row.querySelector('dd') as HTMLElement).click());

  expect(played).toHaveBeenCalledTimes(1);
});

test('a click on the speaker itself reaches its listener exactly once', () => {
  const container = mount();
  const row = container.querySelector(ROW_CLIP_ROW_SELECTOR) as HTMLElement;
  const speaker = row.querySelector<HTMLElement>('[data-row-clip-speaker]') as HTMLElement;
  const played = vi.fn();
  speaker.addEventListener('click', played);

  act(() => speaker.click());

  // The row handler must not press it again: a second toggle would stop the clip at once.
  expect(played).toHaveBeenCalledTimes(1);
});
