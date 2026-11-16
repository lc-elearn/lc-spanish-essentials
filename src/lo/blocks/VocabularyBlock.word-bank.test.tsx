// @vitest-environment happy-dom
/**
 * VocabularyBlock.word-bank.test.tsx — the word bank as a learner uses it (E63, spec
 * §4–5): the A–Z view's letter headings, and the self-test that hides one side and
 * reveals word by word. Mounted, because both need clicks.
 *
 * Language names are derived from the course language, never written in: the Russian
 * course runs these tests with `"languageCode": "ru"` (TODO, 2026-11-09).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ROW_CLIP_ROW_SELECTOR } from '@/audio/row-clip';
import { languageName, TARGET_LANG } from '@/lib/lang';
import { VocabularyBlock } from './VocabularyBlock';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const TARGET = languageName(TARGET_LANG);

const CLIP = 'audio/lo-00-example/placeholder.m4a';

const BANK = {
  topics: [{ id: 'one', heading: 'Topic one' }],
  items: [
    { term: 'beta', gloss: 'second', audio: CLIP, topic: 'one' },
    { term: 'alpha', gloss: 'first', audio: CLIP, topic: 'one' },
    { term: 'alpha beta', gloss: 'both', topic: 'one', only: 'topics' },
    { term: 'gamma', gloss: 'third', only: 'alphabetical' },
    { term: 'amber', gloss: 'fourth', only: 'alphabetical' },
  ],
};

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.innerHTML = '';
});

function mount(options: Record<string, boolean>): HTMLElement {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<VocabularyBlock content={BANK} options={options} />));
  return container;
}

/** The button whose accessible name or text is exactly `name`. */
function button(container: HTMLElement, name: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find(
    (element) => (element.getAttribute('aria-label') ?? element.textContent) === name,
  );
  if (found === undefined) throw new Error(`no button named "${name}"`);
  return found;
}

const press = (element: HTMLElement) => act(() => element.click());
/** The text a reader or a screen reader gets: everything outside `aria-hidden` subtrees. */
function perceived(container: HTMLElement): string {
  const copy = container.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
  return copy.textContent ?? '';
}
const headings = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('h4')).map((heading) => heading.textContent);
const terms = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('dt')).map((term) => term.textContent);

describe('A–Z view with letter headings', () => {
  test('one centred <h4> per letter, the rule drawn in CSS', () => {
    const container = mount({ letterHeadings: true });
    press(button(container, 'Alphabetical'));

    expect(headings(container)).toEqual(['A', 'B', 'G']);
    expect(terms(container)).toEqual(['alpha', 'amber', 'beta', 'gamma']);
    const heading = container.querySelector('h4') as HTMLElement;
    expect(heading.className).toContain('vocabulary-letter');
    // The heading holds its letter and nothing else: the rules are pseudo-elements.
    expect(heading.childNodes).toHaveLength(1);
  });

  test('a second press reverses the list, and the headings with it', () => {
    const container = mount({ letterHeadings: true });
    press(button(container, 'Alphabetical'));
    press(button(container, 'Alphabetical'));

    expect(headings(container)).toEqual(['G', 'B', 'A']);
    expect(terms(container)).toEqual(['gamma', 'beta', 'amber', 'alpha']);
  });

  test('without letterHeadings, the A–Z view is one list', () => {
    const container = mount({});
    press(button(container, 'Alphabetical'));
    expect(headings(container)).toEqual([]);
    expect(terms(container)).toEqual(['alpha', 'amber', 'beta', 'gamma']);
  });
});

describe('self-test', () => {
  test('two toggle buttons in a group named "Test yourself", named for the languages', () => {
    const container = mount({ selfTest: true });
    const group = container.querySelector('[role="group"][aria-label="Test yourself"]');
    expect(group).not.toBeNull();
    expect(Array.from(group?.querySelectorAll('button') ?? []).map((b) => b.textContent)).toEqual([
      `Hide ${TARGET}`,
      'Hide English',
    ]);
    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('false');
  });

  test('hiding the course language hides its words from readers and screen readers, leaving Reveal buttons', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));

    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('true');
    expect(perceived(container)).not.toContain('beta');
    expect(perceived(container)).toContain('second');
    expect(button(container, `Reveal ${TARGET}, word 1`).textContent).toBe('Reveal');
    // `lang` is only ever on the term text itself, never on the <dt> (chrome is English).
    expect(container.querySelector('dt')?.hasAttribute('lang')).toBe(false);
    expect(container.querySelector('dt [lang]')).toBeNull();
  });

  // The column must not jump when a side is hidden (spec §5, found in the browser
  // 2026-11-13): the hidden word stays as an invisible, aria-hidden placeholder that
  // holds the cell's width, in the same grid cell as its Reveal button.
  test('a hidden word keeps its space: an invisible, aria-hidden placeholder under its Reveal button', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));

    const reveal = button(container, `Reveal ${TARGET}, word 1`);
    const cell = reveal.parentElement as HTMLElement;
    expect(cell.className).toContain('vocabulary-hidden-word');
    const placeholder = cell.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(placeholder.textContent).toBe('beta');
    expect(placeholder.className).toContain('invisible');
    expect(placeholder.hasAttribute('tabindex')).toBe(false);
  });

  test('a hidden term’s speaker is named for its slot, not its word, and still works', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    expect(button(container, 'Listen: word 1')).toBeDefined();
    expect(container.innerHTML).not.toContain('Listen: beta');
  });

  test('the term text is in the course language; its speaker name is outside any [lang]', () => {
    const container = mount({ selfTest: true });
    const term = container.querySelector('dt [lang]') as HTMLElement;
    expect(term.getAttribute('lang')).toBe(TARGET_LANG);
    expect(term.textContent).toBe('beta');
    expect(button(container, 'Listen: beta').closest('[lang]')).toBeNull();
    expect(container.querySelector('dt')?.hasAttribute('lang')).toBe(false);
  });

  test('Reveal shows the word and moves focus to it, in the course language', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Reveal ${TARGET}, word 1`));

    const focused = document.activeElement as HTMLElement;
    expect(focused.textContent).toBe('beta');
    expect(focused.closest('[lang]')?.getAttribute('lang')).toBe(TARGET_LANG);
    expect(perceived(container)).not.toContain('alpha');
  });

  test('Reveal English, word 1 moves focus to the gloss', () => {
    const container = mount({ selfTest: true });
    press(button(container, 'Hide English'));
    press(button(container, 'Reveal English, word 1'));

    const focused = document.activeElement as HTMLElement;
    expect(focused.textContent).toBe('second');
    expect(focused.closest('[lang]')).toBeNull();
  });

  test('hiding English hides the glosses and releases the other button', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, 'Hide English'));

    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('false');
    expect(button(container, 'Hide English').getAttribute('aria-pressed')).toBe('true');
    expect(perceived(container)).toContain('beta');
    expect(perceived(container)).not.toContain('second');
    expect(button(container, 'Reveal English, word 2')).toBeDefined();
  });

  test('switching view keeps the hidden side and clears what was revealed', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Reveal ${TARGET}, word 1`));
    press(button(container, 'Alphabetical'));

    expect(button(container, `Hide ${TARGET}`).getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelectorAll('dt button[aria-label^="Reveal"]')).toHaveLength(4);
  });

  test('releasing the pressed button shows everything', () => {
    const container = mount({ selfTest: true });
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Hide ${TARGET}`));

    expect(container.textContent).toContain('beta');
    expect(container.querySelectorAll('button[aria-label^="Reveal"]')).toHaveLength(0);
  });

  test('no row click while a word is hidden; row clicks return once all are revealed', () => {
    const container = mount({ selfTest: true });
    expect(container.querySelectorAll(ROW_CLIP_ROW_SELECTOR)).toHaveLength(2);
    press(button(container, `Hide ${TARGET}`));
    expect(container.querySelectorAll(ROW_CLIP_ROW_SELECTOR)).toHaveLength(0);

    const played = vi.fn();
    const speaker = container.querySelector('[data-row-clip-speaker]') as HTMLElement;
    speaker.addEventListener('click', played);
    press(container.querySelector('dd') as HTMLElement);
    expect(played).not.toHaveBeenCalled();

    for (const number of [1, 2, 3]) press(button(container, `Reveal ${TARGET}, word ${number}`));
    expect(container.querySelectorAll(ROW_CLIP_ROW_SELECTOR)).toHaveLength(2);
  });
});

describe('an entry in two topics', () => {
  const MULTI = {
    topics: [
      { id: 'a', heading: 'Topic a' },
      { id: 'b', heading: 'Topic b' },
    ],
    items: [
      { term: 'beta', gloss: 'second', topic: ['a', 'b'] },
      { term: 'alpha', gloss: 'first', topic: 'b' },
    ],
  };
  const mountMulti = (): HTMLElement => {
    const container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
    act(() => root?.render(<VocabularyBlock content={MULTI} options={{ selfTest: true }} />));
    return container;
  };

  test('shows in each topic, and the two copies are different words by number', () => {
    const container = mountMulti();
    expect(terms(container)).toEqual(['beta', 'beta', 'alpha']);
    press(button(container, `Hide ${TARGET}`));
    expect(button(container, `Reveal ${TARGET}, word 1`)).toBeDefined();
    expect(button(container, `Reveal ${TARGET}, word 2`)).toBeDefined();
  });

  test('revealing one copy reveals the word in both places, and focuses the copy pressed', () => {
    const container = mountMulti();
    press(button(container, `Hide ${TARGET}`));
    press(button(container, `Reveal ${TARGET}, word 2`));

    expect(container.querySelectorAll('button[aria-label^="Reveal"]').length).toBe(1);
    const copies = Array.from(container.querySelectorAll('dt [lang]'));
    expect(copies.map((copy) => copy.textContent)).toEqual(['beta', 'beta']);
    expect(document.activeElement).toBe(copies[1]);
  });
});
