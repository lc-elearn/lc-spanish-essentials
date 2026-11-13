/**
 * block-renderers.ts — maps a block `type` to the component that renders its body.
 *
 * The block-side counterpart of `lazy-registry`: the single place that says "this
 * block `type` is rendered by this component". Blocks are NOT in the exercise
 * registry (they are content, not engines), so they need their own map — but the same
 * contract: a `type` with no entry resolves to `undefined` and the caller handles it
 * visibly, never silently.
 *
 * Not lazy: block bodies are a few paragraphs of static markup with no per-type
 * dependencies, so there is nothing worth code-splitting. (Part D also pre-renders
 * every LO through `renderToStaticMarkup`, where `React.lazy` cannot resolve.)
 *
 * Each renderer validates its own `content` against its per-type schema — the same
 * deliberate deferral the 15 exercise engines use, so `BlockConfigSchema.content`
 * stays loose while every shipped type is still strictly checked.
 */
import type { ComponentType } from 'react';
import type { BlockConfig } from '@/config/lo-schema';
import type { UiStringsOverride } from '@/config/ui-strings';
import { OutcomesBlock } from './OutcomesBlock';
import { SourcesBlock } from './SourcesBlock';
import { TabsBlock } from './TabsBlock';
import { ProseBlock, GrammarBlock, IntroBlock } from './TextBlock';
import { VocabularyBlock } from './VocabularyBlock';

/**
 * Props every block renderer receives: the block's raw, type-specific `content`, and
 * its `presentation`. Most renderers ignore the latter; a renderer with its own
 * headings needs it, because a plain block sits under the section's <h2> and a card
 * under the accordion's <h3>.
 *
 * `options` (E63) are the block's raw per-type switches, already checked at load by
 * `BlockConfigSchema`; the renderer re-parses them for their defaults
 * (`parseBlockOptions`). `labels` is the block's override of the UI strings.
 */
export interface BlockRendererProps {
  content: unknown;
  presentation?: BlockConfig['presentation'];
  options?: unknown;
  labels?: UiStringsOverride;
}

export type BlockRenderer = ComponentType<BlockRendererProps>;

/** The registry. Add an entry when a new block `type` ships. */
export const BLOCK_RENDERERS: Readonly<Record<string, BlockRenderer>> = {
  prose: ProseBlock,
  intro: IntroBlock,
  grammar: GrammarBlock,
  vocabulary: VocabularyBlock,
  outcomes: OutcomesBlock,
  tabs: TabsBlock,
  sources: SourcesBlock,
};

/** Resolve a block renderer by type, or `undefined` if no such type ships. */
export function getBlockRenderer(type: string): BlockRenderer | undefined {
  return BLOCK_RENDERERS[type];
}
