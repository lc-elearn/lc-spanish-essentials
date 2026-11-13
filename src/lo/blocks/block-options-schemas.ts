/**
 * block-options-schemas.ts — which block types take `options`, and the schema each
 * one's are checked against (E63). The block-side twin of `exercise-schemas.ts`: a block
 * type absent here takes no options, and `BlockConfigSchema` refuses any it is given.
 *
 * Relative imports only: `lo-schema.ts` imports this file (AGENTS.md, hard constraint 1).
 */
import type { z } from 'zod';
import { VocabularyBlockOptionsSchema } from './vocabulary-options-schema';

const BLOCK_OPTIONS_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  vocabulary: VocabularyBlockOptionsSchema,
};

/** The options schema for a block `type`, or `undefined` if that type takes none. */
export function blockOptionsSchema(type: string): z.ZodType | undefined {
  // Own keys only: `toString` is not a block type.
  return Object.hasOwn(BLOCK_OPTIONS_SCHEMAS, type) ? BLOCK_OPTIONS_SCHEMAS[type] : undefined;
}
