/**
 * exercise-schemas.ts — maps an exercise `type` key to its full config schema, and to
 * the load check built from it (`options` closed).
 *
 * The one place that says "this `type` is validated by this schema" (review
 * 2026-10-21, concern 1). The Node LO reader (`load-lo-disk.ts`) passes it to
 * `assembleLo`, so every exercise in every LO is checked against its own engine's schema
 * at load: a bad `content`, or an `options` key its engine does not know, fails the build
 * and the dev page, naming the file and the field, instead of reaching a learner as the
 * engine's red error box or being ignored. It is not in the
 * main bundle (the browser reader skips the check). Each engine still re-parses at
 * render, for its defaults.
 *
 * The twin of `lazy-registry.ts`, but schemas only, never views: it runs in the Bun
 * prerender and under Vite SSR in dev, so nothing here may pull in React or an engine's
 * component. The Record is exhaustive over `ExerciseType`, so a new engine
 * key fails to compile until its schema is added here.
 */
import { z } from 'zod';
import type { ExerciseType } from '@/config/exercise-types';
import { ConjugationExerciseConfigSchema } from './conjugation/conjugation-schema';
import { DictationExerciseConfigSchema } from './dictation/dictation-schema';
import { DragFillGapsExerciseConfigSchema } from './drag-fill-gaps/drag-fill-gaps-schema';
import { FlashcardsExerciseConfigSchema } from './flashcards/flashcards-schema';
import { InlineChoiceExerciseConfigSchema } from './inline-choice/inline-choice-schema';
import { InlineGapExerciseConfigSchema } from './inline-gap/inline-gap-schema';
import { LineMatchExerciseConfigSchema } from './line-match/line-match-schema';
import { MemoryMatchExerciseConfigSchema } from './memory-match/memory-match-schema';
import { PhraseReorderExerciseConfigSchema } from './phrase-reorder/phrase-reorder-schema';
import { RadioQuizExerciseConfigSchema } from './radio-quiz/radio-quiz-schema';
import { ReadingExerciseConfigSchema } from './reading/reading-schema';
import { SelectExerciseConfigSchema } from './select/select-schema';
import { TypedTransformExerciseConfigSchema } from './typed-transform/typed-transform-schema';
import { WordOrderExerciseConfigSchema } from './word-order/word-order-schema';
import { WordSpotExerciseConfigSchema } from './word-spot/word-spot-schema';

/**
 * Every engine's full exercise config schema, keyed by its `type`: the schema each engine
 * re-parses at render, which ignores an option key it does not know. The load check,
 * `exerciseConfigSchema`, closes `options`.
 */
export const EXERCISE_CONFIG_SCHEMAS: Readonly<Record<ExerciseType, z.ZodObject>> = {
  select: SelectExerciseConfigSchema,
  'inline-choice': InlineChoiceExerciseConfigSchema,
  'radio-quiz': RadioQuizExerciseConfigSchema,
  'inline-gap': InlineGapExerciseConfigSchema,
  'typed-transform': TypedTransformExerciseConfigSchema,
  dictation: DictationExerciseConfigSchema,
  'word-order': WordOrderExerciseConfigSchema,
  'phrase-reorder': PhraseReorderExerciseConfigSchema,
  'drag-fill-gaps': DragFillGapsExerciseConfigSchema,
  'line-match': LineMatchExerciseConfigSchema,
  'memory-match': MemoryMatchExerciseConfigSchema,
  'word-spot': WordSpotExerciseConfigSchema,
  flashcards: FlashcardsExerciseConfigSchema,
  conjugation: ConjugationExerciseConfigSchema,
  reading: ReadingExerciseConfigSchema,
};

/**
 * An engine's schema with its `options` closed: the options it declares (the shared
 * block, or flashcards' extension of it) and no others. `safeExtend` because some
 * engines refine the whole config, and `extend` refuses to overwrite a key there.
 *
 * @throws Error naming the type when its schema's `options` is not an optional object,
 *   the shape every engine inherits from `ExerciseConfigSchema`
 */
export function withClosedOptions(type: string, schema: z.ZodObject): z.ZodObject {
  const field = schema.shape.options;
  const options = field instanceof z.ZodOptional ? field.unwrap() : undefined;
  if (!(options instanceof z.ZodObject)) {
    throw new Error(
      `the ${type} schema's \`options\` must be an optional object, as ExerciseConfigSchema's is`,
    );
  }
  return schema.safeExtend({ options: options.strict().optional() });
}

const LOAD_SCHEMAS = Object.fromEntries(
  Object.entries(EXERCISE_CONFIG_SCHEMAS).map(([type, schema]) => [
    type,
    withClosedOptions(type, schema),
  ]),
) as Readonly<Record<ExerciseType, z.ZodObject>>;

/**
 * The schema that validates an exercise of `type` at load: its engine's, with `options`
 * closed, so a typo such as `shufle` or `lockDirecton` fails the build naming the file
 * and the key, instead of being ignored (maintainer, 2026-11-11, TODO E59).
 */
export function exerciseConfigSchema(type: ExerciseType): z.ZodType {
  return LOAD_SCHEMAS[type];
}
