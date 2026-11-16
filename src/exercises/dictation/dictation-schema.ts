/**
 * dictation-schema.ts — the exercise envelope for the `dictation` engine (#6). The
 * learner hears a clip and transcribes it. Content is the shared TextEntryContentSchema
 * (rows of answer + audio), with one dictation-specific constraint: EVERY row must
 * carry an audio clip — there is nothing to transcribe without sound, so a missing
 * clip is an authoring error that fails the build, not the browser.
 *
 * The engine renders the shared TextEntryRuntime in `dictation` comparison mode
 * (normalizeForDictation: accent-strict, but punctuation/quote-tolerant). Per spec §9
 * this shares the runtime with typed-transform (#5) and differs only in that mode —
 * the planned component-split is unnecessary, since normalization is a runtime flag.
 *
 * Spec: docs/specs/2026-06-19-exercise-engines-design.md §8, §9.
 */
import { z } from 'zod';
import { splitAlternatives } from '../lib/answer-alternatives';
import { hasTypedAnswer, typedAnswerProblems } from '../lib/answer-checks';
import { normalizeAnswer, normalizeForDictation } from '../lib/answers';
import { ExerciseConfigSchema } from '@/config/lo-schema';
import { TextEntryContentSchema } from '../text-entry/text-entry-schema';

/** Shared content, tightened: every dictation row needs audio (you transcribe what you hear). */
export const DictationContentSchema = TextEntryContentSchema.refine(
  (content) => content.rows.every((row) => Boolean(row.audio)),
  {
    message:
      'Every dictation row must have an audio clip — the learner transcribes what they hear.',
    path: ['rows'],
  },
)
  // Dictation grades with punctuation and quotes ignored, so an answer, or one of its `|`
  // alternatives, of only those leaves nothing to type (TODO §E42, §E54). A blank answer
  // is already refused above; an empty alternative is refused on the envelope.
  .superRefine((content, ctx) => {
    content.rows.forEach((row, index) => {
      const silent = splitAlternatives(row.answer).some(
        (alternative) =>
          hasTypedAnswer(alternative, normalizeAnswer) &&
          !hasTypedAnswer(alternative, normalizeForDictation),
      );
      if (silent) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${index + 1} has nothing to type: dictation ignores punctuation and quotes, so the answer needs words`,
          path: ['rows', index, 'answer'],
        });
      }
    });
  });

export const DictationExerciseConfigSchema = ExerciseConfigSchema.extend({
  type: z.literal('dictation'),
  content: DictationContentSchema,
})
  // An answer's `|` alternatives (TODO §E54), compared as dictation grades them:
  // punctuation and quotes ignored, capitals folded unless `options.caseSensitive`.
  .superRefine((config, ctx) => {
    const caseSensitive = config.options?.caseSensitive ?? false;
    config.content.rows.forEach((row, index) => {
      for (const end of typedAnswerProblems(row.answer, normalizeForDictation, caseSensitive)) {
        ctx.addIssue({
          code: 'custom',
          message: `row ${index + 1} ${end}`,
          path: ['content', 'rows', index, 'answer'],
        });
      }
    });
  });
export type DictationExerciseConfig = z.infer<typeof DictationExerciseConfigSchema>;
