/**
 * vocabulary-self-test.test.ts — the word bank's self-test (E63, spec §5, W7): hide one
 * side, recall, reveal word by word. Either/or: hiding one side shows the other.
 */
import { describe, expect, test } from 'vitest';
import {
  INITIAL_SELF_TEST,
  isAnyHidden,
  isHidden,
  selfTestReducer,
  type SelfTestAction,
  type SelfTestState,
} from './vocabulary-self-test';

const run = (...actions: SelfTestAction[]): SelfTestState =>
  actions.reduce(selfTestReducer, INITIAL_SELF_TEST);

describe('selfTestReducer', () => {
  test('starts with nothing hidden, so the prerender is unchanged', () => {
    expect(INITIAL_SELF_TEST).toEqual({
      hidden: 'none',
      revealed: [],
      lastRow: null,
    });
  });

  test('hide hides one side', () => {
    const state = run({ type: 'hide', side: 'target' });
    expect(isHidden(state, 0, 'target')).toBe(true);
    expect(isHidden(state, 0, 'native')).toBe(false);
  });

  test('either/or: hiding the other side releases the first', () => {
    const state = run({ type: 'hide', side: 'target' }, { type: 'hide', side: 'native' });
    expect(state.hidden).toBe('native');
    expect(isHidden(state, 0, 'target')).toBe(false);
  });

  test('reveal shows one word and remembers it as the one to focus', () => {
    const state = run({ type: 'hide', side: 'target' }, { type: 'reveal', entry: 0, row: 'r0' });
    expect(isHidden(state, 0, 'target')).toBe(false);
    expect(isHidden(state, 1, 'target')).toBe(true);
    expect(state.lastRow).toBe('r0');
  });

  test('reveal remembers the row pressed, so focus goes to that copy of a word', () => {
    const state = run(
      { type: 'hide', side: 'target' },
      { type: 'reveal', entry: 0, row: 'topic-b:0' },
    );
    expect(state.lastRow).toBe('topic-b:0');
    // One word: it is revealed in every place it shows.
    expect(isHidden(state, 0, 'target')).toBe(false);
  });

  test('two entries are independent even when they share a term (a homonym)', () => {
    // Plain list: "мир" peace (entry 0) and "мир" world (entry 1). Hide English, reveal one.
    const state = run({ type: 'hide', side: 'native' }, { type: 'reveal', entry: 0, row: 'r0' });
    expect(isHidden(state, 0, 'native')).toBe(false);
    expect(isHidden(state, 1, 'native')).toBe(true);
  });

  test('reveal does nothing when nothing is hidden, or twice', () => {
    expect(run({ type: 'reveal', entry: 0, row: 'r0' })).toEqual(INITIAL_SELF_TEST);
    const once = run({ type: 'hide', side: 'target' }, { type: 'reveal', entry: 0, row: 'r0' });
    expect(selfTestReducer(once, { type: 'reveal', entry: 0, row: 'r0' })).toBe(once);
  });

  test('switching view keeps the hidden side and clears what was revealed', () => {
    const state = run(
      { type: 'hide', side: 'native' },
      { type: 'reveal', entry: 0, row: 'r0' },
      { type: 'switch-view' },
    );
    expect(state).toEqual({ hidden: 'native', revealed: [], lastRow: null });
  });

  test('pressing the pressed button again releases it and shows everything', () => {
    const state = run(
      { type: 'hide', side: 'target' },
      { type: 'reveal', entry: 0, row: 'r0' },
      { type: 'hide', side: 'target' },
    );
    expect(state).toEqual(INITIAL_SELF_TEST);
  });

  test('never changes the state it was given', () => {
    const before = run({ type: 'hide', side: 'target' });
    const copy = structuredClone(before);
    selfTestReducer(before, { type: 'reveal', entry: 0, row: 'r0' });
    expect(before).toEqual(copy);
  });
});

describe('isAnyHidden', () => {
  test('false with nothing hidden, true while one word is, false once all are revealed', () => {
    const shown = [0, 1];
    expect(isAnyHidden(INITIAL_SELF_TEST, shown)).toBe(false);
    const hidden = run({ type: 'hide', side: 'target' }, { type: 'reveal', entry: 0, row: 'r0' });
    expect(isAnyHidden(hidden, shown)).toBe(true);
    expect(
      isAnyHidden(selfTestReducer(hidden, { type: 'reveal', entry: 1, row: 'r1' }), shown),
    ).toBe(false);
  });
});
