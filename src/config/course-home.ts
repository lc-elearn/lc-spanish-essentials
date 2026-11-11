/**
 * course-home.ts — the `home` setting in course.json (TODO §E55, spec
 * docs/specs/2026-11-10-standalone-lesson-design.md): `"landing"` opens the course on its
 * list of lessons; `"lesson"` opens it on its one lesson, with no landing page.
 *
 * Its own module, apart from course.config.ts, because three runtimes need the one rule:
 * the browser bundle (through course.config.ts), the Bun prerender, and the dev-server
 * plugin, which vite.config.ts imports. So it imports zod and nothing else (AGENTS.md
 * hard constraint 1), and it reads no file: `course-json-disk.ts` does that, for Node.
 */
import { z } from 'zod';

/** Optional, defaulting to today's behaviour, so no course has to edit its course.json. */
export const CourseHomeSchema = z.enum(['landing', 'lesson']).default('landing');

export type CourseHome = z.infer<typeof CourseHomeSchema>;

/** Only `home`; course.config.ts judges the other keys. */
const HomeOnlySchema = z.looseObject({ home: CourseHomeSchema });

/**
 * The `home` setting of a parsed course.json.
 * @throws Error naming course.json and the field, as parseCourseConfig() does
 */
export function parseCourseHome(raw: unknown): CourseHome {
  const result = HomeOnlySchema.safeParse(raw);
  if (!result.success) throw new Error(`course.json is invalid:\n${z.prettifyError(result.error)}`);
  return result.data.home;
}
