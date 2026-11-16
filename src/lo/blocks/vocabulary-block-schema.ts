/**
 * vocabulary-block-schema.ts — the per-type `content` contract for
 * `type: "vocabulary"`, mirroring the per-engine `*-schema.ts` convention.
 *
 * A WORD BANK (E63, spec docs/specs/2026-11-12-vocabulary-word-bank-design.md §3): one
 * list, each entry written once, shown two ways. `topics` groups the topic view;
 * `only` keeps an entry to one view (a phrase to the topics, a headword to A–Z). The
 * cross-entry rules are one superRefine at the end, each message naming the entry. A
 * block is a word bank when it declares `topics` or any entry has `only`; a plain list
 * may repeat a term (the 2015 units do, maintainer 2026-11-13).
 */
import { z } from 'zod';
import { parseRichText } from '../rich-text/parse-rich-text';
import { topicIds } from './vocabulary-views';

const ONLY_VIEWS = ['topics', 'alphabetical'] as const;
type OnlyView = (typeof ONLY_VIEWS)[number];

/** The entry's term for a message, whatever the offending input is. */
const termOf = (input: unknown): string => {
  const term = (input as { term?: unknown } | null)?.term;
  return typeof term === 'string' ? term.normalize('NFC') : '?';
};

export const VocabularyItemSchema = z
  .strictObject(
    {
      /** The target-language word or phrase. */
      term: z.string().min(1),
      /** Its UI-language gloss. */
      gloss: z.string().min(1),
      /**
       * Optional clip of the TERM being said, rendered as a speaker button beside it.
       *
       * Optional because a vocabulary list is useful without audio and a course may not
       * have recordings yet — a required field would make every clone record audio before
       * it could ship a word list. `audio` is a key guard d already sweeps, so a path
       * pointing at a file that is not there fails the build rather than going silent in
       * the browser.
       */
      audio: z.string().min(1).optional(),
      /**
       * The `id` of a declared topic, or a list of them (at least one): the group(s) this entry
       * sits in, in the topic view. A word taught under two topics lists both (2015 units 2
       * and 9, maintainer 2026-11-13); the A–Z view still shows it once.
       */
      topic: z.union([z.string().min(1), z.array(z.string().min(1))]).optional(),
      /** The one view this entry shows in. Absent means both. */
      only: z.custom<OnlyView>().optional(),
    },
    {
      error: (issue) =>
        issue.code === 'unrecognized_keys'
          ? `entry "${termOf(issue.input)}" has unknown key(s) ${issue.keys.map((key) => `"${key}"`).join(', ')} — allowed: term, gloss, audio, topic, only`
          : undefined,
    },
  )
  .superRefine((item, ctx) => {
    if (item.only !== undefined && !ONLY_VIEWS.includes(item.only)) {
      ctx.addIssue({
        code: 'custom',
        path: ['only'],
        message: `entry "${termOf(item)}": "only" must be "topics" or "alphabetical", not ${JSON.stringify(item.only)}`,
      });
    }
  });
export type VocabularyItem = z.infer<typeof VocabularyItemSchema>;

/**
 * An info alert above the list (maintainer, 2026-10-08, after french-lo-1): a lead
 * line ("You will learn:") and a ticked list. Both are INLINE RICH TEXT, like the
 * outcomes block's, so a summary can italicise the words it previews.
 */
export const VocabularySummarySchema = z.object({
  lead: z
    .string()
    .min(1)
    .transform((value) => parseRichText(value)),
  items: z
    .array(z.string().min(1))
    .min(1)
    .transform((entries) => entries.map((entry) => parseRichText(entry))),
});

/** One group of the topic view. Without a `heading` it renders as a divider. */
const VocabularyTopicSchema = z.strictObject({
  id: z.string().min(1),
  heading: z.string().min(1).optional(),
});

const VocabularyBlockContentShape = z.object({
  /** Accordion-level instructions, rendered by LoAccordion's one instructions slot. */
  instructions: z.string().min(1).optional(),
  summary: VocabularySummarySchema.optional(),
  /** The topic view's groups, in display order. Absent: one flat list, as before E63. */
  topics: z.array(VocabularyTopicSchema).min(1).optional(),
  items: z.array(VocabularyItemSchema).min(1),
});

/** How a message names an entry: `items[3] "брак"`. */
const entryName = (index: number, term: string): string =>
  `items[${index}] "${term.normalize('NFC')}"`;

/** Rules 1–4 (spec §3) for one entry, given the declared topic ids. */
function checkEntryTopic(
  item: VocabularyItem,
  index: number,
  declared: readonly string[] | undefined,
  ctx: z.RefinementCtx,
): void {
  const name = entryName(index, item.term);
  const path = ['items', index, 'topic'];
  const ids = topicIds(item);
  if (Array.isArray(item.topic) && ids.length === 0) {
    // Empty list: say so once, and no follow-on "no topic" for the same mistake.
    ctx.addIssue({
      code: 'custom',
      path,
      message: `${name}: "topic" is an empty list — give one id or more`,
    });
    return;
  }
  if (ids.length > 0 && item.only === 'alphabetical') {
    ctx.addIssue({
      code: 'custom',
      path,
      message: `${name} has a topic but "only": "alphabetical", so the topic would never show — remove one`,
    });
    return;
  }
  if (ids.length === 0) {
    if (declared !== undefined && item.only !== 'alphabetical') {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index],
        message: `${name} shows in the topic view but has no "topic" — give it one, or "only": "alphabetical"`,
      });
    }
    return;
  }
  ids.forEach((id, at) => {
    if (ids.indexOf(id) !== at) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `${name} lists topic "${id}" twice — list each topic once`,
      });
    } else if (!(declared ?? []).includes(id)) {
      const known = declared === undefined ? 'none' : declared.join(', ');
      ctx.addIssue({
        code: 'custom',
        path,
        message: `${name}: topic "${id}" is not declared in "topics" (declared: ${known})`,
      });
    }
  });
}

/** The word bank's cross-entry rules (spec §3, 1–5; rule 6 is the enum and the options). */
function checkWordBank(
  content: z.output<typeof VocabularyBlockContentShape>,
  ctx: z.RefinementCtx,
): void {
  const declared = content.topics?.map((topic) => topic.id);
  declared?.forEach((id, index) => {
    if (declared.indexOf(id) !== index) {
      ctx.addIssue({
        code: 'custom',
        path: ['topics', index, 'id'],
        message: `topic "${id}" is declared twice`,
      });
    }
    if (!content.items.some((item) => topicIds(item).includes(id))) {
      ctx.addIssue({
        code: 'custom',
        path: ['topics', index],
        message: `topic "${id}" is declared but no entry uses it`,
      });
    }
  });
  // Rule 5 is a word bank's: a plain list may repeat a term, as the 2015 units do.
  const isWordBank =
    declared !== undefined || content.items.some((item) => item.only !== undefined);
  const firstIndex = new Map<string, number>();
  content.items.forEach((item, index) => {
    checkEntryTopic(item, index, declared, ctx);
    if (!isWordBank) return;
    const key = item.term.normalize('NFC');
    const first = firstIndex.get(key);
    if (first === undefined) {
      firstIndex.set(key, index);
      return;
    }
    ctx.addIssue({
      code: 'custom',
      path: ['items', index, 'term'],
      message: `${entryName(index, item.term)} repeats items[${first}] — write each word once; "only" says which view it shows in`,
    });
  });
}

export const VocabularyBlockContentSchema = VocabularyBlockContentShape.superRefine(checkWordBank);
export type VocabularyBlockContent = z.infer<typeof VocabularyBlockContentSchema>;
