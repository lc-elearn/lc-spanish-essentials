/**
 * assemble-lo.ts — turn one LO's raw files into a single typed, ordered LO.
 *
 * This is the pure half of loading: NO file access. It takes an already-read
 * `LoFileTree` (whatever produced it) and returns an `AssembledLo` — sections in
 * manifest order, each holding its blocks and exercises in their declared order,
 * every part validated against its schema.
 *
 * WHY the I/O is somewhere else: the LO must be readable from BOTH the browser
 * bundle (dev server + `vite build`) and plain Node (Part D pre-renders each LO with
 * `renderToStaticMarkup` in a post-build script). Verified 2026-08-04: neither
 * mechanism spans both — `import.meta.glob` is Vite-only syntax (Bun throws
 * "undefined is not a function"), and `node:fs` does not exist in a browser bundle.
 * So there is one assembler and two thin readers feeding it (`load-lo-glob.ts`,
 * `load-lo-disk.ts`), which keeps validation and ordering defined exactly once.
 *
 * FAIL FAST AND LOUD (spec decision #2): every throw names the offending file the
 * way an author sees it on disk — `lo-config/<slug>/blocks/01-grammar/block.json` —
 * so a bad LO dies at load with a precise message instead of half-rendering.
 *
 * An `exercises` entry may be an exercise set (E57): its tabs load like any exercise, and
 * the set's refusals (two tabs titled alike, mixed engines without instructions) live
 * here because titles and types live in the exercise files.
 *
 * Spec: docs/specs/2026-06-15-lc-base-template-design.md §6, §9, §15;
 *       docs/process/2026-08-04-phase-c-part-c-loader-handover.md §3.
 */
import { z } from 'zod';
import {
  LoManifestSchema,
  BlockConfigSchema,
  LoExerciseConfigSchema,
  HoverConfigSchema,
  ModalConfigSchema,
  type BlockConfig,
  type ExerciseSet,
  type LoExerciseConfig,
  type LoHero,
} from '@/config/lo-schema';
import type { ExerciseType } from '@/config/exercise-types';
import { resolveSetInstructions, savesProgress } from '@/exercises/lib/instructions';
import type { Media } from './blocks/media-schema';
import { parseRichTextEntry } from './rich-text/parse-rich-text-entry';
import {
  collectEntryModalTargets,
  collectHoverTargets,
  collectModalTargets,
} from './rich-text/rich-text-nodes';
import { parseRichText } from './rich-text/parse-rich-text';
import type { HoverContent } from './rich-text/hover/hover-context';
import type { ModalContent } from './rich-text/modal/modal-context';

/**
 * One LO's files, already read and JSON-parsed but NOT yet validated. `blocks` and
 * `exercises` are keyed by ref (the render-mirror folder name, `"01-grammar"`).
 */
export interface LoFileTree {
  /** The raw `lo.json`. */
  readonly manifest: unknown;
  /** ref → raw `blocks/<ref>/block.json`. */
  readonly blocks: Readonly<Record<string, unknown>>;
  /** ref → raw `exercises/<ref>/exercise.json`. */
  readonly exercises: Readonly<Record<string, unknown>>;
  /** id → raw `modals/<id>/modal.json`. Absent is normal: most LOs declare none. */
  readonly modals?: Readonly<Record<string, unknown>>;
  /** id → raw `hovers/<id>/hover.json` (TODO §D17). Absent is normal. */
  readonly hovers?: Readonly<Record<string, unknown>>;
}

/**
 * Which schema checks an exercise's content and options, by type: `exerciseConfigSchema` from
 * `src/exercises/exercise-schemas.ts`. Passed in rather than imported, so the browser
 * reader can leave fifteen schemas out of the main bundle (see `assembleLo`).
 */
export type ExerciseSchemaLookup = (type: ExerciseType) => z.ZodType;

/** One resolved part: the ref it was named by, plus its validated config. */
export interface AssembledPart<TConfig> {
  readonly ref: string;
  readonly config: TConfig;
}

/** One tab of an assembled exercise set: its exercise, and optional media above it. */
export interface AssembledSetTab extends AssembledPart<LoExerciseConfig> {
  readonly media?: Media;
}

/** An exercise set (E57): one accordion, one instruction box, tabs of exercises. */
export interface AssembledExerciseSet {
  readonly kind: 'set';
  /** The accordion id: `exercise-set-<first tab's ref>`, unique because a ref is used once. */
  readonly id: string;
  readonly title: string;
  /** The box above the tabs: the set's own text, or its one engine's default copy. */
  readonly instructions: string;
  readonly tabs: readonly AssembledSetTab[];
}

/** One entry of a section's exercises: a plain exercise, or a set of them in tabs. */
export type AssembledExerciseEntry = AssembledPart<LoExerciseConfig> | AssembledExerciseSet;

/** Whether an assembled exercise entry is a set. */
export function isExerciseSet(entry: AssembledExerciseEntry): entry is AssembledExerciseSet {
  return 'kind' in entry && entry.kind === 'set';
}

/** One section, with its parts resolved in declared order. */
export interface AssembledSection {
  readonly id: string;
  readonly label: string;
  readonly navLabel?: string;
  readonly blocks: readonly AssembledPart<BlockConfig>[];
  readonly exercises: readonly AssembledExerciseEntry[];
}

/** One whole Learning Object, ready to render. */
export interface AssembledLo {
  /** The LO folder name (`lo-00-example`) — the single source of truth for identity. */
  readonly slug: string;
  readonly title: string;
  readonly description?: string;
  /** Author-relative card illustration path; absent when the author declared none. */
  readonly image?: string;
  /** Page hero banner art; absent when the author declared none (the band renders). */
  readonly hero?: LoHero;
  readonly sections: readonly AssembledSection[];
  /**
   * Declared modals, keyed by id, with their prose already parsed to rich-text nodes
   * — never raw strings, so no renderer downstream can re-introduce an HTML
   * injection path (spec §5).
   */
  readonly modals: Readonly<Record<string, ModalContent>>;
  /** Declared hover cards, keyed by id, their lines already parsed (TODO §D17). */
  readonly hovers: Readonly<Record<string, HoverContent>>;
  /** The modal id the footer's Credits button opens; absent when lo.json sets none (E56). */
  readonly credits?: string;
}

/** An author-facing path for the LO file at `relative` inside this LO's folder. */
function loPath(slug: string, relative: string): string {
  return `lo-config/${slug}/${relative}`;
}

/** Parse `raw` against `schema`, or throw naming `filePath` and what was wrong. */
function parseFile<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  raw: unknown,
  filePath: string,
): z.output<TSchema> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new Error(`${filePath} is invalid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

/** Look a ref up in one of the tree's part maps, or throw naming the missing file. */
function requireFile(
  parts: Readonly<Record<string, unknown>>,
  ref: string,
  filePath: string,
): unknown {
  if (!(ref in parts)) {
    throw new Error(`${filePath} is missing — a section references "${ref}" but no such file`);
  }
  return parts[ref];
}

/**
 * Validate and stitch one LO. Sections keep manifest order; within a section, blocks
 * come first and then exercises, each in its declared array order (the two lists are
 * separate because they mirror the two on-disk folders).
 *
 * With `exerciseSchema`, each exercise's content is also checked against its own
 * engine's schema (review 2026-10-21, concern 1). The Node reader always passes it, so
 * every build and every dev page fails on a bad exercise, naming the file and the field.
 * The browser reader does not: the page it hydrates was built, and so checked, already,
 * and the schemas would cost the main bundle about 2.3 kB gzipped.
 *
 * @param slug the LO folder name, e.g. `lo-00-example`
 * @param tree the LO's already-read files
 * @param exerciseSchema the per-type content schemas; absent skips that check
 * @throws Error naming the offending file when any part is missing or invalid
 */
export function assembleLo(
  slug: string,
  tree: LoFileTree,
  exerciseSchema?: ExerciseSchemaLookup,
): AssembledLo {
  const manifestPath = loPath(slug, 'lo.json');
  const manifest = parseFile(LoManifestSchema, tree.manifest, manifestPath);

  const modals = Object.fromEntries(
    manifest.modals.map((id) => {
      const filePath = loPath(slug, `modals/${id}/modal.json`);
      const config = parseFile(
        ModalConfigSchema,
        requireFile(tree.modals ?? {}, id, filePath),
        filePath,
      );
      return [
        id,
        {
          id,
          title: config.title,
          // Parsed HERE, at load, so a bad tag dies naming the file the author edits.
          // Popups only may hold an <h3> (E56): the dialog title is the h2.
          content: config.content.map((entry) =>
            parseRichTextEntry(entry, filePath, { headings: true }),
          ),
          ...(config.lang === undefined ? {} : { lang: config.lang }),
        } satisfies ModalContent,
      ];
    }),
  );

  const hovers = Object.fromEntries(
    manifest.hovers.map((id) => {
      const filePath = loPath(slug, `hovers/${id}/hover.json`);
      const config = parseFile(
        HoverConfigSchema,
        requireFile(tree.hovers ?? {}, id, filePath),
        filePath,
      );
      // Inline rich text only: the card sits inside a paragraph. Parsed here, at load,
      // so a bad tag dies naming the file. A card inside a card is not allowed.
      const content = (config.content ?? []).map((line) => {
        const nodes = parseRichText(line);
        if (collectHoverTargets(nodes).length > 0) {
          throw new Error(`${filePath}: a hover card cannot hold another hover term`);
        }
        collectModalTargets(nodes).forEach((target) => {
          if (!(target in modals)) {
            throw new Error(
              `${filePath} links to modal "${target}", which lo.json does not declare`,
            );
          }
        });
        return nodes;
      });
      return [
        id,
        {
          id,
          content,
          ...(config.title === undefined ? {} : { title: config.title }),
          ...(config.path === undefined ? {} : { path: config.path }),
          ...(config.lang === undefined ? {} : { lang: config.lang }),
        } satisfies HoverContent,
      ];
    }),
  );

  /** One exercise file, checked against the envelope and, if given, its engine's schema. */
  const loadExercise = (ref: string): LoExerciseConfig => {
    const filePath = loPath(slug, `exercises/${ref}/exercise.json`);
    const raw = requireFile(tree.exercises, ref, filePath);
    const config = parseFile(LoExerciseConfigSchema, raw, filePath);
    // The envelope only says which engine; the engine's own schema checks the
    // content and the options, here at load, so a bad exercise fails the build and not
    // the learner.
    if (exerciseSchema) parseFile(exerciseSchema(config.type), raw, filePath);
    return config;
  };

  /** One exercise set: its tabs resolved, its labels unique, its box decided (E57). */
  const assembleSet = (set: ExerciseSet): AssembledExerciseSet => {
    const tabs = set.tabs.map<AssembledSetTab>((tab) => ({
      ref: tab.exercise,
      config: loadExercise(tab.exercise),
      ...(tab.media === undefined ? {} : { media: tab.media }),
    }));
    const titles = new Set<string>();
    for (const { config } of tabs) {
      if (titles.has(config.title)) {
        throw new Error(
          `${manifestPath}: the exercise set "${set.title}" has two tabs titled "${config.title}" — a tab's label is its exercise's title, and learners tell tabs apart by it`,
        );
      }
      titles.add(config.title);
    }
    const types = tabs.map((tab) => tab.config.type);
    const instructions = resolveSetInstructions(set.instructions, types, {
      // Every tab saves under its lesson, so a deck that saves progress always does.
      savesProgress: tabs.some((tab) => savesProgress(tab.config)),
    });
    if (instructions === null) {
      throw new Error(
        `${manifestPath}: the exercise set "${set.title}" mixes ${[...new Set(types)].join(' and ')} — write its instructions, since no one engine's default copy fits`,
      );
    }
    return {
      kind: 'set',
      // A ref is used once per lesson (S7), so the first tab's ref names the set uniquely.
      id: `exercise-set-${set.tabs[0]?.exercise ?? ''}`,
      title: set.title,
      instructions,
      tabs,
    };
  };

  const sections = manifest.sections.map<AssembledSection>((section) => ({
    id: section.id,
    label: section.label,
    ...(section.navLabel === undefined ? {} : { navLabel: section.navLabel }),
    blocks: section.blocks.map((ref) => {
      const filePath = loPath(slug, `blocks/${ref}/block.json`);
      return {
        ref,
        config: parseFile(BlockConfigSchema, requireFile(tree.blocks, ref, filePath), filePath),
      };
    }),
    exercises: section.exercises.map<AssembledExerciseEntry>((entry) =>
      typeof entry === 'string' ? { ref: entry, config: loadExercise(entry) } : assembleSet(entry),
    ),
  }));

  // Cross-reference guard: a modal link pointing at an undeclared modal is an author
  // error, caught here rather than surfacing as a dead button in the browser. Only
  // modal-to-modal links can be checked at this layer — block prose is parsed by its
  // per-type content schema at render, so links authored there are covered by the
  // repo-wide guard in `lo-rich-text.test.ts` instead (spec §5).
  Object.values(modals).forEach((modal) => {
    collectEntryModalTargets(modal.content).forEach((target) => {
      if (!(target in modals)) {
        throw new Error(
          `${loPath(slug, `modals/${modal.id}/modal.json`)} links to modal "${target}", ` +
            `which lo.json does not declare — known modals: ${Object.keys(modals).join(', ') || '(none)'}`,
        );
      }
    });
  });

  return {
    slug,
    title: manifest.title,
    ...(manifest.description === undefined ? {} : { description: manifest.description }),
    ...(manifest.image === undefined ? {} : { image: manifest.image }),
    ...(manifest.hero === undefined ? {} : { hero: manifest.hero }),
    sections,
    modals,
    hovers,
    ...(manifest.credits === undefined ? {} : { credits: manifest.credits }),
  };
}
