// @vitest-environment happy-dom
/**
 * VocabularyBlock.repeated-term.test.tsx — a plain list may repeat a term (the 2015
 * units teach some words twice). It re-sorts without React's duplicate-key warning and
 * keeps both rows.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { VocabularyBlock } from './VocabularyBlock';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const CONTENT = {
  items: [
    { term: 'beta', gloss: 'second' },
    { term: 'alpha', gloss: 'first' },
    { term: 'beta', gloss: 'second again' },
  ],
};

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

test('A–Z sorts both rows of a repeated term, with no duplicate-key warning', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<VocabularyBlock content={CONTENT} />));
  const az = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent === 'Alphabetical',
  );
  act(() => az?.click());
  const terms = Array.from(container.querySelectorAll('dt')).map((dt) => dt.textContent);
  expect(terms).toEqual(['alpha', 'beta', 'beta']);
  expect(error).not.toHaveBeenCalled();
  error.mockRestore();
});

test('a homonym: revealing one gloss leaves the other row hidden', () => {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root?.render(
      <VocabularyBlock
        content={{
          items: [
            { term: 'мир', gloss: 'peace' },
            { term: 'мир', gloss: 'world' },
          ],
        }}
        options={{ selfTest: true }}
      />,
    ),
  );
  const named = (name: string) =>
    Array.from(container.querySelectorAll('button')).find(
      (b) => (b.getAttribute('aria-label') ?? b.textContent) === name,
    );
  act(() => named('Hide English')?.click());
  act(() => named('Reveal English, word 1')?.click());
  expect(named('Reveal English, word 2')).toBeDefined();
  expect(named('Reveal English, word 1')).toBeUndefined();
});
