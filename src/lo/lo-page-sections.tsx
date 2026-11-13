/**
 * lo-page-sections.tsx — the adapter: an assembled LO → the shell's `PageSection[]`.
 *
 * The one place JSON becomes DOM. It knows about both halves and nothing else knows
 * about both: `assembleLo` produces ordered, validated data with no React in it, and
 * `PageLayout` renders sections with no knowledge of LOs.
 *
 * Per section, in declared order: one `LoAccordion` per block, then one per exercise
 * or exercise set (E57, rendered by `ExerciseSetBody`).
 * (Blocks before exercises mirrors the two on-disk folders the manifest keeps
 * separate.) Block bodies render through `LoBlock` (which resolves `getBlockRenderer`); exercise bodies mount
 * through `ExerciseHost`, which owns the instruction box and resolves the engine via
 * `lazy-registry` — the same path the showcase uses, so the wiring is defined once.
 *
 * Accordion ids are namespaced by KIND (`block-01-grammar`, `exercise-01-select`,
 * `exercise-set-03-drag-fill-gaps` for a set, named by its first tab's ref).
 * Refs are unique per kind LO-wide, so this cannot collide with itself, and the
 * prefix keeps it out of the section-anchor namespace (`#grammar`) — which matters
 * because `headingId()` derives `{id}-heading` from both.
 *
 * Spec: docs/specs/lo-semantic-structure.md §1, §1a, §2, §3.
 */
import type { ReactNode } from 'react';
import LoAccordion from '@/components/shell/LoAccordion';
import type { PageSection } from '@/components/shell/PageLayout';
import { ExerciseHost } from '@/exercises/lib/ExerciseHost';
import {
  isExerciseSet,
  type AssembledExerciseSet,
  type AssembledLo,
  type AssembledSection,
} from './assemble-lo';
import { ExerciseSetBody } from './ExerciseSet';
import { LoBlock } from './LoBlock';

/** An exercise set: one accordion, its box, then its tabs (E57). Each tab's exercise saves
 * progress under the same key it would standalone, so moving it into a set keeps it. */
function exerciseSet(set: AssembledExerciseSet, slug: string): ReactNode {
  return (
    <LoAccordion key={set.id} id={set.id} title={set.title}>
      <ExerciseSetBody
        label={set.title}
        instructions={set.instructions}
        tabs={set.tabs.map((tab) => ({
          id: tab.ref,
          label: tab.config.title,
          type: tab.config.type,
          config: tab.config,
          progressId: `${slug}/${tab.ref}`,
          ...(tab.media === undefined ? {} : { media: tab.media }),
        }))}
      />
    </LoAccordion>
  );
}

/** One section's blocks, then its exercises, each in declared order. Each block renders
 * through `LoBlock`, which owns the plain/card branch. An exercise saves progress under
 * its LO and exercise folders (`lo-03-food/02-flashcards`). */
function sectionContent(section: AssembledSection, slug: string): ReactNode {
  return (
    <div className="space-y-3">
      {section.blocks.map(({ ref, config }) => (
        <LoBlock key={`block-${ref}`} id={`block-${ref}`} config={config} />
      ))}

      {section.exercises.map((entry) =>
        isExerciseSet(entry) ? (
          exerciseSet(entry, slug)
        ) : (
          <LoAccordion
            key={`exercise-${entry.ref}`}
            id={`exercise-${entry.ref}`}
            title={entry.config.title}
          >
            {/* ExerciseHost renders the instruction box itself, so the accordion's own
                instructions slot stays empty here — one instruction box, not two. */}
            <ExerciseHost
              type={entry.config.type}
              config={entry.config}
              progressId={`${slug}/${entry.ref}`}
            />
          </LoAccordion>
        ),
      )}
    </div>
  );
}

/** Map an assembled LO to the ordered section list the shell renders. */
export function toPageSections(lo: AssembledLo): PageSection[] {
  return lo.sections.map((section) => ({
    id: section.id,
    label: section.label,
    ...(section.navLabel === undefined ? {} : { navLabel: section.navLabel }),
    content: sectionContent(section, lo.slug),
  }));
}
