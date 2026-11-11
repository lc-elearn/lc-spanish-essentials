/**
 * assemble-lo.test.ts — the pure assembler: manifest + raw part files → one typed,
 * ordered LO. No I/O here (that is the readers' job), so every failure mode is
 * exercised with hand-built trees.
 */
import { test, expect } from 'vitest';
import { exerciseConfigSchema } from '@/exercises/exercise-schemas';
import { EXERCISE_INSTRUCTIONS, SAVED_PROGRESS_INSTRUCTIONS } from '@/exercises/lib/instructions';
import { assembleLo, isExerciseSet, type LoFileTree } from './assemble-lo';

/** A valid two-section tree used as the base for the cases below. */
function validTree(): LoFileTree {
  return {
    manifest: {
      title: 'Salutations',
      description: 'Greet people',
      sections: [
        { id: 'grammar', label: 'Grammar rules', navLabel: 'Grammar', blocks: ['01-grammar'] },
        { id: 'exercises', label: 'Exercises', exercises: ['01-select', '02-radio-quiz'] },
      ],
    },
    blocks: {
      '01-grammar': { type: 'grammar', title: 'Ser vs estar', content: { text: 'Yo soy.' } },
    },
    exercises: {
      '01-select': {
        type: 'select',
        title: 'Pick one',
        content: { items: [{ text: 'a [*b|c]' }] },
      },
      '02-radio-quiz': {
        type: 'radio-quiz',
        title: 'Quiz',
        content: { questions: [{ prompt: '¿Hola?', options: ['*sí', 'no'] }] },
      },
    },
  };
}

test('assembleLo: returns sections and their items in declared order', () => {
  const lo = assembleLo('lo-01-salutations', validTree());

  expect(lo.slug).toBe('lo-01-salutations');
  expect(lo.title).toBe('Salutations');
  expect(lo.description).toBe('Greet people');
  expect(lo.sections.map((section) => section.id)).toEqual(['grammar', 'exercises']);
  expect(lo.sections[0].navLabel).toBe('Grammar');
  expect(
    lo.sections[1].exercises.map((exercise) => !isExerciseSet(exercise) && exercise.ref),
  ).toEqual(['01-select', '02-radio-quiz']);
});

test('assembleLo: carries the manifest card image through to the assembled LO', () => {
  const tree = validTree();
  const lo = assembleLo('lo-01-salutations', {
    ...tree,
    manifest: { ...(tree.manifest as object), image: 'images/salutations.svg' },
  });

  expect(lo.image).toBe('images/salutations.svg');
});

test('assembleLo: omits the image key entirely when the manifest declares none', () => {
  const lo = assembleLo('lo-01-salutations', validTree());

  expect('image' in lo).toBe(false);
});

test('assembleLo: carries the manifest hero through to the assembled LO', () => {
  const tree = validTree();
  const lo = assembleLo('lo-01-salutations', {
    ...tree,
    manifest: { ...(tree.manifest as object), hero: { src: 'images/lo-01/hero.webp' } },
  });

  expect(lo.hero).toEqual({ src: 'images/lo-01/hero.webp' });
});

test('assembleLo: omits the hero key entirely when the manifest declares none', () => {
  const lo = assembleLo('lo-01-salutations', validTree());

  expect('hero' in lo).toBe(false);
});

test('assembleLo: resolves each ref to its parsed config', () => {
  const lo = assembleLo('lo-01-salutations', validTree());

  expect(lo.sections[0].blocks[0].config.title).toBe('Ser vs estar');
  expect(lo.sections[0].blocks[0].config.type).toBe('grammar');
  // Schema defaults are applied, so renderers never re-derive them.
  expect(lo.sections[0].blocks[0].config.defaultOpen).toBe(false);
  const first = lo.sections[1].exercises[0];
  expect(first !== undefined && !isExerciseSet(first) && first.config.type).toBe('select');
});

test('assembleLo: a section with no exercises gets an empty list, not undefined', () => {
  const lo = assembleLo('lo-01-salutations', validTree());
  expect(lo.sections[0].exercises).toEqual([]);
});

// --- Fail fast and loud, naming the offending file --------------------------

test('assembleLo: a malformed manifest names lo.json', () => {
  const tree = { ...validTree(), manifest: { sections: [] } };
  expect(() => assembleLo('lo-01-salutations', tree)).toThrow(
    /lo-config\/lo-01-salutations\/lo\.json/,
  );
});

test('assembleLo: a missing block file names the path it looked for', () => {
  const tree = { ...validTree(), blocks: {} };
  expect(() => assembleLo('lo-01-salutations', tree)).toThrow(
    /lo-config\/lo-01-salutations\/blocks\/01-grammar\/block\.json/,
  );
});

test('assembleLo: a missing exercise file names the path it looked for', () => {
  const tree = validTree();
  expect(() =>
    assembleLo('lo-01-salutations', {
      ...tree,
      exercises: { '01-select': tree.exercises['01-select'] },
    }),
  ).toThrow(/lo-config\/lo-01-salutations\/exercises\/02-radio-quiz\/exercise\.json/);
});

test('assembleLo: an untitled block names its own file, not the manifest', () => {
  const tree = validTree();
  const error = (() => {
    try {
      assembleLo('lo-01-salutations', {
        ...tree,
        blocks: { '01-grammar': { type: 'grammar', content: {} } },
      });
      return null;
    } catch (thrown) {
      return thrown as Error;
    }
  })();

  expect(error?.message).toMatch(/blocks\/01-grammar\/block\.json/);
  expect(error?.message).toMatch(/title/);
});

test('assembleLo: an unknown exercise type is rejected at load', () => {
  const tree = validTree();
  expect(() =>
    assembleLo('lo-01-salutations', {
      ...tree,
      exercises: {
        ...tree.exercises,
        '01-select': { type: 'fill-gaps', title: 'X', content: {} },
      },
    }),
  ).toThrow(/exercises\/01-select\/exercise\.json/);
});

// Review 2026-10-21, concern 1: an exercise's content was only checked by its engine at
// render, so `"content": {}` passed tests and the build and failed in front of a learner.
test('assembleLo: rejects exercise content its engine schema refuses, naming file and field', () => {
  const tree = validTree();
  const exercises = {
    ...tree.exercises,
    '01-select': { type: 'select', title: 'Pick', content: {} },
  };

  expect(() =>
    assembleLo('lo-01-salutations', { ...tree, exercises }, exerciseConfigSchema),
  ).toThrow(
    /lo-config\/lo-01-salutations\/exercises\/01-select\/exercise\.json is invalid[\s\S]*content\.items/,
  );
});

// Audit 2026-10-23 (TODO §E34): a select blank with no `*` built, and graded every option
// wrong. The reader the build uses now refuses it, naming file, blank and sentence.
test('assembleLo: rejects a blank no learner could answer, naming file, blank and sentence', () => {
  const tree = validTree();
  const exercises = {
    ...tree.exercises,
    '01-select': {
      type: 'select',
      title: 'Pick',
      content: { items: [{ text: 'Yo [soy|eres|es] de Madrid.' }] },
    },
  };

  expect(() =>
    assembleLo('lo-01-salutations', { ...tree, exercises }, exerciseConfigSchema),
  ).toThrow(
    /exercises\/01-select\/exercise\.json is invalid[\s\S]*\[soy\|eres\|es\] has no correct option[\s\S]*content\.items\[0\]\.text/,
  );
});

test('assembleLo: checks every exercise type against its own engine schema', () => {
  const tree = validTree();
  const exercises = {
    ...tree.exercises,
    '02-radio-quiz': { type: 'radio-quiz', title: 'Quiz', content: { items: [{ text: 'x' }] } },
  };

  expect(() =>
    assembleLo('lo-01-salutations', { ...tree, exercises }, exerciseConfigSchema),
  ).toThrow(/exercises\/02-radio-quiz\/exercise\.json is invalid/);
});

test('assembleLo: leaves content to the engine when no schema lookup is passed', () => {
  const tree = validTree();
  const exercises = {
    ...tree.exercises,
    '01-select': { type: 'select', title: 'Pick', content: {} },
  };

  expect(() => assembleLo('lo-01-salutations', { ...tree, exercises })).not.toThrow();
});

test('assembleLo: passes a valid tree through the engine schemas unchanged', () => {
  expect(assembleLo('lo-01-salutations', validTree(), exerciseConfigSchema)).toEqual(
    assembleLo('lo-01-salutations', validTree()),
  );
});

// --- Engine-only options --------------------------------------------------------
// The envelope checks the options every engine shares; an engine's own options (the
// flashcards' srs, direction and lockDirection) must still reach the engine, from both
// readers alike, or a lesson's deck neither saves progress nor keeps its direction.

/** A one-exercise tree whose exercise is a flashcards deck with these `options`. */
function treeWithDeck(options: object): LoFileTree {
  return {
    manifest: {
      title: 'Salutations',
      sections: [{ id: 'exercises', label: 'Exercises', exercises: ['01-flashcards'] }],
    },
    blocks: {},
    exercises: {
      '01-flashcards': {
        type: 'flashcards',
        title: 'Deck',
        content: { cards: [{ target: 'el perro', native: 'the dog' }] },
        options,
      },
    },
  };
}

test("assembleLo: a lesson's flashcards deck keeps its engine-only options", () => {
  const options = { srs: true, direction: 'native-target', lockDirection: true };
  const node = assembleLo('lo-01-salutations', treeWithDeck(options), exerciseConfigSchema);
  const browser = assembleLo('lo-01-salutations', treeWithDeck(options));

  for (const lo of [node, browser]) {
    const deck = lo.sections[0]?.exercises[0];
    if (deck === undefined || isExerciseSet(deck)) throw new Error('expected an exercise');
    expect(deck.config.options).toMatchObject(options);
  }
  // The prerender (Node reader) and the hydrating page (browser reader) must agree.
  expect(node).toEqual(browser);
});

// The Node reader refuses a select's `srs` (E59, below); the browser reader checks no
// engine options, so `savesProgress` must still ask for a deck.
test('assembleLo: a stray srs on a set of selects does not promise saved progress', () => {
  const tree = treeWithSet({
    title: 'Parts',
    tabs: [{ exercise: '03-select' }, { exercise: '04-select' }],
  });
  const exercises = {
    ...tree.exercises,
    '03-select': { ...(tree.exercises['03-select'] as object), options: { srs: true } },
  };
  const lo = assembleLo('lo-01-salutations', { ...tree, exercises });
  const set = lo.sections[0]?.exercises[1];

  expect(set !== undefined && isExerciseSet(set) && set.instructions).toBe(
    EXERCISE_INSTRUCTIONS.select,
  );
});

test('assembleLo: a bad engine-only option fails the build, naming the file', () => {
  expect(() =>
    assembleLo('lo-01-salutations', treeWithDeck({ direction: 'sideways' }), exerciseConfigSchema),
  ).toThrow(/exercises\/01-flashcards\/exercise\.json is invalid[\s\S]*direction/);
});

// Maintainer, 2026-11-11 (E59): a typo in an option key fails the build, naming the
// file and the key, instead of being ignored.
test('assembleLo: an unknown option key fails the build, naming the file and the key', () => {
  expect(() =>
    assembleLo('lo-01-salutations', treeWithDeck({ lockDirecton: true }), exerciseConfigSchema),
  ).toThrow(/exercises\/01-flashcards\/exercise\.json is invalid[\s\S]*"lockDirecton"/);
});

test('assembleLo: a deck option on a select fails the build, naming the file', () => {
  const tree = validTree();
  const exercises = {
    ...tree.exercises,
    '01-select': { ...(tree.exercises['01-select'] as object), options: { srs: true } },
  };
  expect(() =>
    assembleLo('lo-01-salutations', { ...tree, exercises }, exerciseConfigSchema),
  ).toThrow(/exercises\/01-select\/exercise\.json is invalid[\s\S]*"srs"/);
});

test('assembleLo: a popup may hold an <h3>, and credits is carried through (E56)', () => {
  const tree = validTree();
  const lo = assembleLo('lo-01-salutations', {
    ...tree,
    manifest: { ...(tree.manifest as object), modals: ['credits'], credits: 'credits' },
    modals: { credits: { title: 'Credits', content: ['Made by us.', '<h3>Team</h3>'] } },
  });
  expect(lo.credits).toBe('credits');
  expect(lo.modals.credits.content[1]).toEqual({
    kind: 'heading',
    children: [{ kind: 'text', value: 'Team' }],
  });
});

test('assembleLo: omits credits entirely when the manifest declares none', () => {
  expect('credits' in assembleLo('lo-01-salutations', validTree())).toBe(false);
});

// --- Exercise sets (E57) ---------------------------------------------------------

/** validTree's files plus three tab exercises, with `set` listed after 01-select. */
function treeWithSet(set: object): LoFileTree {
  const tree = validTree();
  return {
    ...tree,
    manifest: {
      title: 'Salutations',
      sections: [{ id: 'exercises', label: 'Exercises', exercises: ['01-select', set] }],
    },
    exercises: {
      ...tree.exercises,
      '03-select': { type: 'select', title: 'Part 1', content: { items: [{ text: 'a [*b|c]' }] } },
      '04-select': { type: 'select', title: 'Part 2', content: { items: [{ text: 'd [*e|f]' }] } },
      '05-inline-choice': {
        type: 'inline-choice',
        title: 'Part 3',
        content: { items: [{ text: 'g [*h|i]' }] },
      },
    },
  };
}

test('assembleLo: a set resolves its tabs in order, with their media (E57)', () => {
  const lo = assembleLo(
    'lo-01-salutations',
    treeWithSet({
      title: 'Parts',
      tabs: [
        { exercise: '03-select' },
        { exercise: '04-select', media: { audio: { src: 'audio/x.m4a' } } },
      ],
    }),
    exerciseConfigSchema,
  );
  const set = lo.sections[0]?.exercises[1];
  if (set === undefined || !isExerciseSet(set)) throw new Error('expected a set');

  expect(set.id).toBe('exercise-set-03-select');
  expect(set.title).toBe('Parts');
  expect(set.instructions).toBe(EXERCISE_INSTRUCTIONS.select);
  expect(set.tabs.map((tab) => [tab.ref, tab.config.title])).toEqual([
    ['03-select', 'Part 1'],
    ['04-select', 'Part 2'],
  ]);
  expect(set.tabs[1]?.media).toEqual({ audio: { src: 'audio/x.m4a' } });
});

test('assembleLo: a set of different engines must write its instructions (S2)', () => {
  const tabs = [{ exercise: '03-select' }, { exercise: '05-inline-choice' }];

  expect(() => assembleLo('lo-01-salutations', treeWithSet({ title: 'Mixed', tabs }))).toThrow(
    /lo-config\/lo-01-salutations\/lo\.json[\s\S]*"Mixed"[\s\S]*write its instructions/,
  );
  const lo = assembleLo(
    'lo-01-salutations',
    treeWithSet({ title: 'Mixed', instructions: 'Do all three.', tabs }),
  );
  const set = lo.sections[0]?.exercises[1];
  expect(set !== undefined && isExerciseSet(set) && set.instructions).toBe('Do all three.');
});

test('assembleLo: a set of decks that save progress says so in its box', () => {
  const card = { cards: [{ target: 'el perro', native: 'the dog' }] };
  const deck = (title: string) => ({
    type: 'flashcards',
    title,
    content: card,
    options: { srs: true },
  });
  const lo = assembleLo('lo-01-salutations', {
    manifest: {
      title: 'Salutations',
      sections: [
        {
          id: 'exercises',
          label: 'Exercises',
          exercises: [
            {
              title: 'Decks',
              tabs: [{ exercise: '01-flashcards' }, { exercise: '02-flashcards' }],
            },
          ],
        },
      ],
    },
    blocks: {},
    exercises: { '01-flashcards': deck('Animals'), '02-flashcards': deck('Houses') },
  });
  const set = lo.sections[0]?.exercises[0];

  expect(set !== undefined && isExerciseSet(set) && set.instructions).toBe(
    `${EXERCISE_INSTRUCTIONS.flashcards} ${SAVED_PROGRESS_INSTRUCTIONS}`,
  );
});

test('assembleLo: two tabs titled alike fail — the title is the tab label', () => {
  const tree = treeWithSet({
    title: 'Parts',
    tabs: [{ exercise: '03-select' }, { exercise: '04-select' }],
  });
  const exercises = {
    ...tree.exercises,
    '04-select': { ...(tree.exercises['04-select'] as object), title: 'Part 1' },
  };

  expect(() => assembleLo('lo-01-salutations', { ...tree, exercises })).toThrow(
    /two tabs titled "Part 1"/,
  );
});

test('assembleLo: a tab naming a missing exercise names the file', () => {
  expect(() =>
    assembleLo(
      'lo-01-salutations',
      treeWithSet({ title: 'Parts', tabs: [{ exercise: '03-select' }, { exercise: '09-select' }] }),
    ),
  ).toThrow(/lo-config\/lo-01-salutations\/exercises\/09-select\/exercise\.json is missing/);
});

test("assembleLo: a tab's exercise is checked against its engine's schema", () => {
  const tree = treeWithSet({
    title: 'Parts',
    tabs: [{ exercise: '03-select' }, { exercise: '04-select' }],
  });
  const exercises = {
    ...tree.exercises,
    '04-select': { type: 'select', title: 'Part 2', content: {} },
  };

  expect(() =>
    assembleLo('lo-01-salutations', { ...tree, exercises }, exerciseConfigSchema),
  ).toThrow(/exercises\/04-select\/exercise\.json is invalid/);
});
