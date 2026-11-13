/**
 * exercise-sets.ts — the exercise showcase's exercise-set cards (E57, spec §7).
 *
 * "Exercise set": two tabs of one engine and no instructions, so the engine's default copy
 * shows above the tabs (S2). "Every engine in a tab": one tab per engine, each its first
 * showcase fixture, which `e2e/debug/exercise-set-engines.spec.ts` opens one by one to
 * prove every engine works in a tab (S6). Progress keys get a `set/` segment, so a deck in
 * a tab never shares saved progress with its own card above.
 */
import { EXERCISE_TYPE_KEYS } from '@/config/exercise-types';
import { resolveSetInstructions } from '@/exercises/lib/instructions';
import { selectFixtures } from '@/exercises/select/select.fixture';
import type { ExerciseSetTabView } from '@/lo/ExerciseSet';
import type { ShowcaseFixture } from './fixture-types';
import { SHOWCASE_FIXTURES } from './fixtures';

/** One set card: an anchor id, a title, its box and its tabs. */
export interface ShowcaseSet {
  readonly id: string;
  readonly title: string;
  readonly instructions: string;
  readonly tabs: readonly ExerciseSetTabView[];
}

function tabOf(fixture: ShowcaseFixture, label: string): ExerciseSetTabView {
  return {
    id: fixture.id,
    label,
    type: fixture.type,
    config: fixture.config,
    progressId: `showcase/set/${fixture.id}`,
  };
}

const oneEngine = selectFixtures
  .slice(0, 2)
  .map((fixture, index) => tabOf(fixture, `Part ${index + 1}`));
const oneEngineCopy = resolveSetInstructions(
  undefined,
  oneEngine.map((tab) => tab.type),
);
if (oneEngineCopy === null) throw new Error('the one-engine showcase set mixes engines');

const everyEngine = EXERCISE_TYPE_KEYS.map((type) => {
  const fixture = SHOWCASE_FIXTURES.find((candidate) => candidate.type === type);
  if (fixture === undefined) throw new Error(`no showcase fixture for ${type}`);
  return tabOf(fixture, type);
});

export const SHOWCASE_SETS: readonly ShowcaseSet[] = [
  {
    id: 'exercise-set',
    title: 'Exercise set — two tabs of one engine',
    instructions: oneEngineCopy,
    tabs: oneEngine,
  },
  {
    id: 'exercise-set-every-engine',
    title: 'Exercise set — every engine in a tab',
    instructions:
      'One tab per engine, each its first showcase fixture. Each tab keeps its own Check, Reset and Show answers.',
    tabs: everyEngine,
  },
];
