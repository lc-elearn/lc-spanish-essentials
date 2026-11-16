/**
 * vocabulary-options-schema.ts — the vocabulary block's `options` (E63, spec §3):
 * switches that change how the word bank is shown, never what it holds. Both default
 * off, so a block without `options`, as every course has today, renders as before (W3).
 *
 * Its own file, with zod as its only import: `lo-schema.ts` reaches it through
 * `block-options-schemas.ts`, and the envelope's imports stay relative and light.
 */
import { z } from 'zod';

export const VocabularyBlockOptionsSchema = z.strictObject({
  /** Hide {language} / Hide English buttons, and a Reveal button per hidden word. */
  selfTest: z.boolean().default(false),
  /** Letter headings in the A–Z view, from the course language's collation. */
  letterHeadings: z.boolean().default(false),
});
