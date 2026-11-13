/**
 * TabsBlock — `type: "tabs"`: labelled tabs, one panel showing at a time, each panel the
 * same rich text a grammar block takes. The tab UI itself is `TabSet`
 * (`src/components/shell/TabSet.tsx`), shared with the exercise set since E57.
 *
 * Each panel: the instruction box, then the tab's media, then its text.
 *
 * Spec: docs/specs/2026-10-07-tabs-block-design.md §4, §5.
 */
import InstructionsCallout from '@/components/shell/InstructionsCallout';
import { TabSet } from '@/components/shell/TabSet';
import { RichTextEntries } from '../rich-text/RichTextEntries';
import { MediaPanel } from './MediaPanel';
import { parseBlockContent } from './parse-block-content';
import { TabsBlockContentSchema } from './tabs-block-schema';

export function TabsBlock({ content }: { content: unknown }) {
  const { label, intro, tabs } = parseBlockContent('tabs', TabsBlockContentSchema, content);

  return (
    <div className="space-y-4">
      {intro === undefined ? null : (
        <div className="space-y-3">
          <RichTextEntries entries={intro} paragraphClassName="text-foreground" />
        </div>
      )}
      <TabSet
        label={label}
        tabs={tabs.map((tab) => ({
          key: tab.label,
          label: tab.label,
          panel: (
            <>
              {/* The accordions' instruction box, first in every panel. */}
              <InstructionsCallout className="mt-0 mb-3">{tab.instructions}</InstructionsCallout>
              {tab.media === undefined ? null : <MediaPanel media={tab.media} className="mb-4" />}
              <div className="space-y-3">
                <RichTextEntries entries={tab.text} paragraphClassName="text-foreground" />
              </div>
            </>
          ),
        }))}
      />
    </div>
  );
}
