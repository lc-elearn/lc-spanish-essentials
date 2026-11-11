/**
 * exercise-sets.test.ts — the showcase's two set cards (E57): one engine with its default
 * copy above the tabs, and every engine in a tab.
 */
import { expect, test } from 'vitest';
import { EXERCISE_TYPE_KEYS } from '@/config/exercise-types';
import { EXERCISE_INSTRUCTIONS } from '@/exercises/lib/instructions';
import { SHOWCASE_SETS } from './exercise-sets';

const byId = (id: string) => SHOWCASE_SETS.find((set) => set.id === id);

test('the one-engine set shows that engine default copy above two tabs', () => {
  const set = byId('exercise-set');

  expect(set?.tabs).toHaveLength(2);
  expect(set?.instructions).toBe(EXERCISE_INSTRUCTIONS.select);
});

test('the every-engine set has one tab per engine, in registry order', () => {
  expect(byId('exercise-set-every-engine')?.tabs.map((tab) => tab.type)).toEqual([
    ...EXERCISE_TYPE_KEYS,
  ]);
});
