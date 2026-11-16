/**
 * ExerciseSet — the body of an exercise set (E57): one instruction box, then tabs that
 * each hold one exercise, with the tab's media above it.
 *
 * View-level on purpose: it takes ready-to-render tabs, not assembled LO data, so the
 * lesson page (`lo-page-sections.tsx`, inside `LoAccordion`) and the exercise showcase
 * (inside its card) render a set through exactly this path.
 *
 * ONE BOX, ABOVE THE TABS (maintainer, 2026-11-11, spec S2): its text arrives resolved
 * (`resolveSetInstructions`). A TAB HAS NO BOX "unless the tab has its own" (S3): each
 * exercise renders with `defaultInstructions={false}`, so only an `instructions` its
 * exercise.json wrote shows. Controls and score stay per tab (S4): each engine owns them.
 *
 * The tab UI is `TabSet`, whose panels stay mounted, so a learner's answers survive a
 * switch to another tab and back. The box keeps its own bottom margin, as it does above
 * a standalone exercise, so the wrapper adds none.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §5.
 */
import { TabSet } from '@/components/shell/TabSet';
import type { ExerciseType } from '@/config/exercise-types';
import { ExerciseHost } from '@/exercises/lib/ExerciseHost';
import { ExerciseInstructions } from '@/exercises/lib/ExerciseInstructions';
import { MediaPanel } from './blocks/MediaPanel';
import type { Media } from './blocks/media-schema';

/** One tab as the set renders it. */
export interface ExerciseSetTabView {
  /** Stable key: the exercise's folder ref, or a showcase fixture id. */
  readonly id: string;
  /** The tab's label: its exercise's title. */
  readonly label: string;
  readonly type: ExerciseType;
  /** The validated exercise config, passed to the engine as-is. */
  readonly config: unknown;
  /** Where the exercise saves progress; the standalone key, `<lesson>/<ref>`. */
  readonly progressId?: string;
  /** Optional image and/or audio above the exercise. */
  readonly media?: Media;
}

interface ExerciseSetBodyProps {
  /** The tab row's accessible name: the set's title. */
  label: string;
  /** The box above the tabs, already resolved. */
  instructions: string;
  tabs: readonly ExerciseSetTabView[];
}

export function ExerciseSetBody({ label, instructions, tabs }: ExerciseSetBodyProps) {
  return (
    <div>
      <ExerciseInstructions text={instructions} />
      <TabSet
        label={label}
        tabs={tabs.map((tab) => ({
          key: tab.id,
          label: tab.label,
          panel: (
            <>
              {tab.media === undefined ? null : <MediaPanel media={tab.media} className="mb-4" />}
              <ExerciseHost
                type={tab.type}
                config={tab.config}
                defaultInstructions={false}
                {...(tab.progressId === undefined ? {} : { progressId: tab.progressId })}
              />
            </>
          ),
        }))}
      />
    </div>
  );
}
