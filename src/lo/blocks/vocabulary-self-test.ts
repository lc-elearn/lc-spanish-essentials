/**
 * vocabulary-self-test.ts — the word bank's self-test as one pure reducer (E63, spec §5).
 * The view holds only `useReducer(selfTestReducer, INITIAL_SELF_TEST)`.
 *
 * Either/or (W7): `hidden` is one side or none, so hiding one side shows the other.
 * Entries are revealed one by one, by their index in the authored list: the two copies of
 * a word listed under two topics are one entry and reveal together, while separate
 * entries that share a term (a homonym in a plain list) are independent.
 * `lastRow` is the row the view moves focus to. Switching view keeps the hidden
 * side and forgets what was revealed; pressing the pressed button again shows all.
 *
 * Initial state hides nothing, so the prerendered markup equals the first client render.
 */
import { NATIVE_LANGUAGE_NAME, TARGET_LANGUAGE_NAME } from '@/lib/lang';

/** Which side of every entry a hide button covers: the course language, or English. */
export type HideSide = 'target' | 'native';

/** The language each side of a row is in, by name: the one map the controls and rows share. */
export const LANGUAGE_NAMES: Readonly<Record<HideSide, string>> = {
  target: TARGET_LANGUAGE_NAME,
  native: NATIVE_LANGUAGE_NAME,
};

export interface SelfTestState {
  readonly hidden: HideSide | 'none';
  /** Authored indexes of the entries revealed since the side was hidden or the view switched. */
  readonly revealed: readonly number[];
  /**
   * The ROW whose Reveal was pressed, which takes focus. An entry listed under two topics
   * is revealed in both places but is two rows; focus goes to the one pressed.
   */
  readonly lastRow: string | null;
}

export type SelfTestAction =
  | { readonly type: 'hide'; readonly side: HideSide }
  | { readonly type: 'reveal'; readonly entry: number; readonly row: string }
  | { readonly type: 'switch-view' };

export const INITIAL_SELF_TEST: SelfTestState = {
  hidden: 'none',
  revealed: [],
  lastRow: null,
};

export function selfTestReducer(state: SelfTestState, action: SelfTestAction): SelfTestState {
  switch (action.type) {
    case 'hide':
      return {
        hidden: state.hidden === action.side ? 'none' : action.side,
        revealed: [],
        lastRow: null,
      };
    case 'reveal':
      if (state.hidden === 'none' || state.revealed.includes(action.entry)) return state;
      return {
        ...state,
        revealed: [...state.revealed, action.entry],
        lastRow: action.row,
      };
    case 'switch-view':
      return { ...state, revealed: [], lastRow: null };
  }
}

/** Whether `side` of the entry at authored `index` is hidden now. */
export function isHidden(state: SelfTestState, index: number, side: HideSide): boolean {
  return state.hidden === side && !state.revealed.includes(index);
}

/** Whether any of `indexes` (the entries shown) has a side hidden: row clicks stop (W8). */
export function isAnyHidden(state: SelfTestState, indexes: readonly number[]): boolean {
  return state.hidden !== 'none' && indexes.some((index) => !state.revealed.includes(index));
}
