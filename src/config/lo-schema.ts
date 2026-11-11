/**
 * lo-schema.ts — Zod contract for a folder-per-LO (spec §6, §9, §15).
 *
 * WHAT: the shape a Learning Object folder must satisfy. An LO ships as a folder
 * under `lo-config/lo-NN-slug/`:
 *
 *   lo-01-salutations/
 *     lo.json                       ← manifest: meta + ORDERED sections + their refs
 *     blocks/01-grammar/block.json
 *     blocks/02-vocabulary/block.json
 *     exercises/01-select/exercise.json
 *     exercises/02-fill-gaps/exercise.json
 *
 * Schemas, one per file kind (plus the section shape inside the manifest):
 *   - LoManifestSchema   → validates `lo.json`
 *   - LoSectionSchema    → validates one entry of the manifest's `sections[]`
 *   - BlockConfigSchema  → validates each content block's `block.json`
 *   - ExerciseConfigSchema → validates each exercise's `exercise.json`
 *   - LoExerciseConfigSchema → the same envelope as referenced BY an LO (title required)
 *   - ExerciseSetSchema  → one exercise set inside a section's exercises[] (E57)
 *
 * WHY (spec decision #2 + §8/§9): validate-at-load. The loader (step 13c) parses
 * every part AND the assembled LO with these schemas, so a malformed manifest or a
 * `chekc` typo in a `labels` override fails the build with a precise message —
 * never a course that only breaks in the browser. Config drift fails fast and loud.
 *
 * SCOPE NOTE (deliberately loose now): `content` is an open object here. Exact
 * per-exercise-type content shapes are explicitly deferred (spec §19) and arrive
 * cluster-by-cluster from step 14, where `type` resolves to an engine via
 * `lazy-registry`. Ordinal+type ref naming (`01-grammar`) is validated structurally
 * here (non-empty string); the folder↔config render-mirror match is guard b's job
 * (steps 19–26), not pulled forward into the schema. `type` is now a Zod enum of the
 * 15 canonical keys (`exercise-types.ts`).
 *
 * SLUG: not a field. The folder name (`lo-01-salutations`) is the single source of
 * truth; the URL slug strips the `lo-NN-` ordinal prefix (`/salutations.html`) in
 * the build's auto-discovery (step 15). Nothing here carries or derives it.
 *
 * Spec: docs/specs/2026-06-15-lc-base-template-design.md §6, §9, §15.
 */
import { z } from 'zod';
import { UiStringsOverrideSchema } from './ui-strings';
import { EXERCISE_TYPE_KEYS } from './exercise-types';
// Relative, like every other import in this file.
import { SetTabMediaSchema } from '../lo/blocks/media-schema';

/**
 * Shared behavior switches for ANY exercise (spec §5/§6). One shape for all 15
 * engines; every field optional; VALUES are set per instance, so two exercises of
 * the same `type` can behave differently (one shuffled, one not). Reset and the
 * show-after-wrong-check reveal are implicit (always on), so they are not fields.
 */
export const ExerciseOptionsSchema = z.object({
  /** Randomize presented choices (default off; author opts in). Reset re-shuffles when on. */
  shuffle: z.boolean().default(false),
  /** Show a random N of M choices; omit = show all. Positive integer. */
  sampleSize: z.number().int().positive().optional(),
  /** false removes the Show-answers control entirely (e.g. a pure game). */
  allowShowAnswers: z.boolean().default(true),
  /**
   * Failed tries before Show answers appears (maintainer, 2026-10-12): Checks with
   * anything wrong, missed pairs (memory-match) or wrong clicks (word-spot). Omit for
   * the engine's default, as french-lo-1: 1, or 2 for word-order, phrase-reorder,
   * drag-fill-gaps and memory-match (`src/exercises/lib/reveal.ts`).
   */
  showAnswersAfter: z.number().int().min(1).optional(),
  /**
   * Typed answers only: true makes capitals count ("Los gatos" ≠ "los gatos"). Off by
   * default (maintainer, 2026-10-08, TODO §D15): in a gap-fill a capital is rarely the
   * point. Accents always count either way.
   */
  caseSensitive: z.boolean().default(false),
});
export type ExerciseOptions = z.infer<typeof ExerciseOptionsSchema>;

/**
 * Validates one content block's `block.json` (grammar, vocabulary, …). Block `type`
 * is a free string — block kinds are not in the exercise registry; it selects a
 * body renderer (`src/lo/blocks/block-renderers.ts`).
 *
 * `title` is the accordion's `<h3>`. Required FOR A CARD BLOCK: it is human text with
 * no derivable source (the same argument as a section's `label` — a ref like
 * `01-grammar` has already lost capitalisation and accents), and blocks exist ONLY
 * inside an LO, so there is no titleless consumer to spare.
 *
 * `presentation` decides whether the block is an OBJECT ON THE PAGE or THE PAGE
 * TALKING. `card` (the default, so nothing existing changes) wraps the body in an
 * accordion: a disclosure, a bordered surface, and an `<h3>`. `plain` wraps it in
 * nothing — the body renders straight into the section, under the section's own
 * `<h2>`, which is what makes an introduction read as page copy rather than as one
 * more panel among the exercises.
 *
 * A `plain` block therefore has no accordion, so `title` and `defaultOpen` describe
 * nothing. A `title` is REJECTED rather than ignored, as is `defaultOpen: true`
 * (an explicit `false` cannot be told from an absent field once `.default()` has
 * run, and is harmless either way). A config field that is quietly
 * dropped is the same bug class as the footer's `href: '#'`, which now fails the
 * build precisely so that an author finds out at build time instead of never.
 */
export const BlockConfigSchema = z
  .object({
    type: z.string().min(1),
    /** Accordion heading (`<h3>` inside `<summary>`). Blank rejected. Card blocks
     *  only — a plain block has no accordion to head. */
    title: z.string().min(1).optional(),
    /** `card` → wrapped in an accordion. `plain` → rendered bare into the section. */
    presentation: z.enum(['card', 'plain']).default('card'),
    /**
     * Whether this block's accordion starts open. Accordions default to closed;
     * prose an author expects to be READ on arrival (an introduction) opts in.
     * Exercises deliberately have no equivalent — a page of pre-opened exercises is
     * a wall of controls.
     */
    defaultOpen: z.boolean().default(false),
    labels: UiStringsOverrideSchema.optional(),
    content: z.looseObject({}),
  })
  // A card block is headed by its title, so it must have one.
  .refine((block) => block.presentation !== 'card' || block.title !== undefined, {
    path: ['title'],
    message: "A card block needs a title — it is the accordion's <h3>.",
  })
  // A plain block has no accordion, so a title would render nowhere. Reject it
  // rather than drop it silently.
  .refine((block) => block.presentation !== 'plain' || block.title === undefined, {
    path: ['title'],
    message: 'A plain block has no accordion to head — remove `title`.',
  })
  // Same for defaultOpen: there is nothing to open. Only `true` can be caught here,
  // because `.default(false)` makes an absent field indistinguishable from an
  // explicit `false` by the time this runs — and an explicit `false` is harmless.
  .refine((block) => block.presentation !== 'plain' || block.defaultOpen !== true, {
    path: ['defaultOpen'],
    message: 'A plain block has no accordion to open — remove `defaultOpen`.',
  });
export type BlockConfig = z.infer<typeof BlockConfigSchema>;

/**
 * Validates one exercise's `exercise.json`. `type` MUST be one of the 15 canonical
 * keys (an unknown key fails the build); `options` is the shared behavior block;
 * `content` stays loose here (per-type shape lands when that engine is ported).
 */
export const ExerciseConfigSchema = z.object({
  type: z.enum(EXERCISE_TYPE_KEYS),
  /**
   * Accordion heading (`<h3>`). OPTIONAL here because the showcase supplies its
   * card title out-of-band (`ShowcaseFixture.title`) — a showcase card is not an
   * LO accordion. Inside an LO it is required; see LoExerciseConfigSchema.
   */
  title: z.string().min(1).optional(),
  labels: UiStringsOverrideSchema.optional(),
  content: z.looseObject({}),
  options: ExerciseOptionsSchema.optional(),
});
export type ExerciseConfig = z.infer<typeof ExerciseConfigSchema>;

/**
 * An exercise AS REFERENCED BY an LO section: the shared envelope with `title`
 * promoted to required, because every LO exercise renders inside an accordion and
 * that accordion needs its `<h3>`. This is what the loader validates first; the
 * per-type `content` tightening (SelectContentSchema et al.) belongs to each ENGINE,
 * and the Node reader checks it at load too, through `src/exercises/exercise-schemas.ts`
 * (review 2026-10-21), so a bad exercise fails the build. Guard e proves every engine
 * HAS one (the third step of the authoring contract, design spec §13 "Rare path") — it
 * deliberately does not parse content itself, which would make a registry guard fail
 * for content reasons.
 *
 * `options` is loose here, as `content` is: the envelope checks and defaults the options
 * every engine shares, and keeps the rest untouched, so an engine's own (flashcards'
 * `srs`, `direction`, `lockDirection`) reach that engine, whose schema checks them (at
 * load in the Node reader, at render in the engine). A closed object stripped them, and
 * what `assembleLo` hands the page is this parse, so a lesson's deck lost them before its
 * engine saw them. The browser reader has no engine schemas, so keeping them here is what
 * makes both readers agree. A key the exercise's engine does not know (a typo, or a deck's
 * `srs` on a select) is refused at load by the Node reader, naming the file and the key
 * (`exerciseConfigSchema`, TODO E59), so it never reaches a build. Only this envelope is
 * loose: `ExerciseConfigSchema`, which every engine schema extends, stays closed, so a
 * fixture's typo still fails to compile.
 */
export const LoExerciseConfigSchema = ExerciseConfigSchema.extend({
  title: z.string().min(1),
  options: ExerciseOptionsSchema.loose().optional(),
});
export type LoExerciseConfig = z.infer<typeof LoExerciseConfigSchema>;

/**
 * A section `id` doubles as the in-page `#anchor` and feeds `headingId()`
 * (`grammar` → `grammar-heading`), so it must be URL-safe lowercase kebab-case.
 */
const SECTION_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Validates one modal's `modals/<id>/modal.json` — a popup launched from inline
 * authored prose (`<a class="modal-link" data-modal-target="…">`).
 *
 * `content` is an ARRAY of paragraphs, each holding inline rich text, for the same
 * reason `TextBlockContentSchema.text` is: the renderer must never guess where prose
 * breaks. The strings stay strings here — the ALLOWLIST is enforced by the rich-text
 * parser at load, not by Zod, because "which tags are legal" is one contract that
 * belongs in one place (`parse-rich-text.ts`).
 *
 * Spec: docs/specs/lo-rich-text-modals.md §2, §4.
 */
export const ModalConfigSchema = z.object({
  /**
   * The dialog's accessible name. Required, so a dialog can never be nameless — a
   * modal with no name is unusable with a screen reader.
   */
  title: z.string().min(1),
  /** One entry per paragraph of inline rich text. At least one — an empty modal is a bug. */
  content: z.array(z.string().min(1)).min(1),
  /**
   * Set when the body is TARGET-language content (WCAG 3.1.2, semantic-structure §3).
   * Omit for UI-language commentary, which inherits `lang` from <html>.
   */
  lang: z.string().min(1).optional(),
});
export type ModalConfig = z.infer<typeof ModalConfigSchema>;

/**
 * Validates one hover card's `hovers/<id>/hover.json` (maintainer, 2026-10-09; TODO
 * §D17) — extra detail for a term in authored prose
 * (`<span class="hover-term" data-hover-target="…">`), shown on hover, focus or tap.
 *
 * The card sits INSIDE a paragraph, so it holds inline content only: an optional
 * title, an optional `path` (shown in words and drawn as a folder tree) and optional
 * lines of inline rich text. It must say something: a path or at least one line.
 */
export const HoverConfigSchema = z
  .object({
    title: z.string().min(1).optional(),
    /** A path in the repo, e.g. `lo-config/lo-00-example/lo.json`. Drawn as a tree. */
    path: z.string().min(1).optional(),
    /** One line of INLINE rich text each (no lists or tables: the card is in a <p>). */
    content: z.array(z.string().min(1)).min(1).optional(),
    /** Set when the text is target-language content (WCAG 3.1.2). */
    lang: z.string().min(1).optional(),
  })
  .refine((card) => card.path !== undefined || card.content !== undefined, {
    message: 'a hover card needs a path or some content',
  });
export type HoverConfig = z.infer<typeof HoverConfigSchema>;

/**
 * An EXERCISE SET (E57): one accordion, one instruction box, then tabs that each hold one
 * exercise folder, listed in a section's `exercises` beside the plain refs so it keeps its
 * place among them (maintainer, 2026-11-11, spec S1).
 *
 * `title` is the accordion's <h3> and names the tab row; a tab's label is its exercise's
 * own `title`, checked for uniqueness by the loader, which reads the exercise files.
 * `instructions` is optional (S2): absent, the loader uses the one engine's default copy.
 * A tab's `media` may have audio without a transcript (S5). Strict throughout.
 *
 * Spec: docs/specs/2026-11-11-tab-exercises-design.md §3.
 */
export const ExerciseSetTabSchema = z.strictObject({
  /** An exercise folder ref, e.g. "03-drag-fill-gaps". */
  exercise: z.string().min(1),
  /** Optional image and/or audio shown above the exercise. */
  media: SetTabMediaSchema.optional(),
});

export const ExerciseSetSchema = z.strictObject({
  title: z.string().min(1),
  /** Plain text; trimmed, so a blank string fails rather than showing an empty box. */
  instructions: z.string().trim().min(1).optional(),
  tabs: z.array(ExerciseSetTabSchema).min(2),
});
export type ExerciseSet = z.infer<typeof ExerciseSetSchema>;

/**
 * One entry of a section's `exercises`: a folder ref, or a set of them in tabs.
 *
 * Not a plain `z.union`: a failed union reports "invalid input" and hides which key was
 * misspelt. A non-string is parsed by the set schema alone, so its own issues surface.
 */
export const SectionExerciseSchema = z
  .union([z.string(), z.looseObject({})])
  .transform((entry, ctx): string | ExerciseSet => {
    const result = (typeof entry === 'string' ? z.string().min(1) : ExerciseSetSchema).safeParse(
      entry,
    );
    if (result.success) return result.data;
    for (const issue of result.error.issues) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: issue.path });
    }
    return z.NEVER;
  });
export type SectionExercise = z.infer<typeof SectionExerciseSchema>;

/**
 * One top-level section of the page, declared BY the LO (decision D1, 2026-08-04).
 *
 * The manifest owns page structure: there is no code-side `type → section` map and
 * no `section` field duplicated into every block. Order is the ARRAY order — never
 * JS object key insertion order, which the french-lo-1 reference relied on by
 * accident (reorder two keys there and the page silently reorders).
 *
 * Introduction is an ordinary section (decision D2): no hardcoded first nav entry
 * anywhere. A nav entry exists because CONTENT exists — which is why a section with
 * neither blocks nor exercises is rejected rather than emitting a link to nothing.
 *
 * `blocks` / `exercises` stay separate arrays (not one `items[{kind, ref}]` list)
 * because the split mirrors the on-disk folders, so a ref resolves trivially:
 * `blocks/<ref>/block.json` vs `exercises/<ref>/exercise.json`. An `exercises` entry
 * may also be an exercise set, whose tabs name exercise refs (E57).
 */
export const LoSectionSchema = z
  .object({
    /** In-page anchor + heading-id base. URL-safe kebab-case, e.g. `going-to-a-cafe`. */
    id: z.string().regex(SECTION_ID_PATTERN, 'section id must be url-safe kebab-case'),
    /**
     * The section's `<h2>` text AND its default nav text (decision D3). Required and
     * never derived from `id`: an id is already stripped of accents and case
     * (`going-to-a-cafe` lost the é in *café*; `faq` → "Faq").
     */
    label: z.string().min(1),
    /** Shorter nav-only override; nav text resolves as `navLabel ?? label`. */
    navLabel: z.string().min(1).optional(),
    /** Ordered content-block refs for this section, e.g. ["01-grammar"]. */
    blocks: z.array(z.string().min(1)).default([]),
    /** Ordered exercise refs and exercise sets, e.g. ["01-select", { "title": …, "tabs": … }]. */
    exercises: z.array(SectionExerciseSchema).default([]),
  })
  .refine((section) => section.blocks.length + section.exercises.length > 0, {
    message: 'section must reference at least one block or exercise',
  });
export type LoSection = z.infer<typeof LoSectionSchema>;

/**
 * The LO page's hero banner art (spec docs/specs/2026-10-05-lo-hero-banner-design.md §3).
 *
 * `src` is an author-relative asset path resolved through `resolveAsset()` at render,
 * like the card's `image`. Blank is rejected for the same reason: an empty path resolves
 * to the page itself.
 *
 * `alt` is optional and ABSENT MEANS DECORATIVE. The hero carries the page's <h1>, so
 * the image's default name must be empty or a screen reader reads the title twice.
 * Supply it only when the artwork says something the title does not. Blank is rejected:
 * omission already means decorative, and "" would be a second spelling of it.
 *
 * Strict, so a misspelt key (`scr`) fails at load instead of silently dropping the art.
 * `src` sits under a key guard d already collects (`ASSET_KEYS`), so a missing file
 * fails the suite with no guard change.
 */
export const LoHeroSchema = z.strictObject({
  src: z.string().min(1),
  alt: z.string().min(1).optional(),
});
export type LoHero = z.infer<typeof LoHeroSchema>;

/**
 * Validates an LO folder's `lo.json` manifest: LO meta plus its ORDERED `sections[]`.
 * Ordinal ref prefixes (`01-`, `02-`) stay LO-wide per kind; the array is what orders
 * items WITHIN a section.
 */
export const LoManifestSchema = z
  .object({
    /** LO display title; feeds the per-LO <head>/page heading. Blank rejected. */
    title: z.string().min(1),
    /** Optional meta description for the LO's <head>. Omit the key when unused. */
    description: z.string().min(1).optional(),
    /**
     * Optional illustration for this LO's card on the course landing page. An
     * author-relative asset path (`images/first-contact.webp`) resolved against
     * `BASE_URL` by `resolveAsset()` at render — never used as written, or it would
     * 404 under a non-root base (anti-pattern #28). Omit the key and the card falls
     * back to a decorative icon band, so an image is never required to ship an LO.
     *
     * Blank is rejected rather than treated as "no image": an empty path resolves to
     * the base URL itself, which would request the page as an image.
     */
    image: z.string().min(1).optional(),
    /**
     * Optional hero banner art for this LO's page — a wide crop, separate from the
     * card's `image` because a card crop and a banner crop rarely suit one file. Omit
     * it and the hero renders as a token-coloured band, so every LO page opens the
     * same way and no LO is blocked on artwork.
     */
    hero: LoHeroSchema.optional(),
    /** The page, in order. At least one — an LO with no sections renders nothing. */
    sections: z.array(LoSectionSchema).min(1),
    /**
     * Modal ids this LO declares, each resolving to `modals/<id>/modal.json`.
     *
     * Top-level, NOT inside a section: a modal is not page structure — it has no
     * heading in the document outline and can be linked from any section's prose.
     * Declared explicitly rather than discovered by globbing the folder, for the same
     * reason sections are (decision D1): an undeclared file is then a detectable
     * authoring mistake instead of silently-live content.
     */
    modals: z
      .array(z.string().regex(SECTION_ID_PATTERN, 'modal id must be url-safe kebab-case'))
      .default([]),
    /**
     * Hover-card ids this LO declares, each resolving to `hovers/<id>/hover.json`.
     * Top-level and declared for the same reasons as `modals` (TODO §D17).
     */
    hovers: z
      .array(z.string().regex(SECTION_ID_PATTERN, 'hover id must be url-safe kebab-case'))
      .default([]),
    /**
     * The modal the footer's Credits button opens (E56). Optional: absent, the footer
     * has no Credits button. Must be one of `modals`, checked below.
     * Spec: docs/specs/2026-11-11-footer-credits-design.md §3.
     */
    credits: z
      .string()
      .regex(SECTION_ID_PATTERN, 'credits must be a modal id (url-safe kebab-case)')
      .optional(),
  })
  .superRefine((manifest, ctx) => {
    // Duplicate ids would collide as BOTH `#anchor` targets and `{id}-heading` ids.
    const seen = new Set<string>();
    manifest.sections.forEach((section, index) => {
      if (seen.has(section.id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate section id "${section.id}"`,
          path: ['sections', index, 'id'],
        });
      }
      seen.add(section.id);
    });

    // An exercise is used once per lesson (E57, S7): twice repeats its DOM ids and shares
    // its saved progress. In a section or in one tab of a set, never both.
    const usedExercises = new Set<string>();
    manifest.sections.forEach((section, sectionIndex) => {
      section.exercises.forEach((entry, entryIndex) => {
        const at = ['sections', sectionIndex, 'exercises', entryIndex];
        const uses =
          typeof entry === 'string'
            ? [{ ref: entry, path: at }]
            : entry.tabs.map((tab, tabIndex) => ({
                ref: tab.exercise,
                path: [...at, 'tabs', tabIndex, 'exercise'],
              }));
        for (const { ref, path } of uses) {
          if (usedExercises.has(ref)) {
            ctx.addIssue({
              code: 'custom',
              message: `exercise "${ref}" is used twice in this lesson — use it once, in a section or in one tab of a set`,
              path,
            });
          }
          usedExercises.add(ref);
        }
      });
    });

    // A duplicate modal id would silently shadow one modal's content with another's.
    const seenModals = new Set<string>();
    manifest.modals.forEach((id, index) => {
      if (seenModals.has(id)) {
        ctx.addIssue({
          code: 'custom',
          message: `duplicate modal id "${id}"`,
          path: ['modals', index],
        });
      }
      seenModals.add(id);
    });

    // A Credits button that opens nothing would be a dead control in every page footer.
    if (manifest.credits !== undefined && !manifest.modals.includes(manifest.credits)) {
      ctx.addIssue({
        code: 'custom',
        message: `credits names modal "${manifest.credits}", which modals does not declare — add it to modals`,
        path: ['credits'],
      });
    }
  });
export type LoManifest = z.infer<typeof LoManifestSchema>;
