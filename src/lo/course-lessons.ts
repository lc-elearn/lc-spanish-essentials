/**
 * course-lessons.ts — the course's own lessons, and which one a `home: "lesson"` course
 * opens on (TODO §E55, spec docs/specs/2026-11-10-standalone-lesson-design.md).
 *
 * One rule for counting lessons, used by the landing page (`buildLoIndex`), the prerender,
 * the dev server and the browser tests: the example lesson counts only while it is the
 * only one (lo-index.ts says why).
 *
 * Alias-free and pure: the dev-server plugin, which vite.config.ts imports, uses it
 * (AGENTS.md hard constraint 1).
 */
import type { CourseHome } from '../config/course-home';
import { sortLoFolders } from './lo-slug';

/** The example lesson's folder: the template's demo and every course's master copy. */
export const EXAMPLE_LO_FOLDER = 'lo-00-example';

/** The course's own lessons, in course order: the example left out once there is another. */
export function courseLessonFolders(folders: readonly string[]): readonly string[] {
  const sorted = sortLoFolders(folders);
  const hasOwnLesson = sorted.some((folder) => folder !== EXAMPLE_LO_FOLDER);
  return sorted.filter((folder) => !(hasOwnLesson && folder === EXAMPLE_LO_FOLDER));
}

/**
 * The one lesson a `home: "lesson"` course shows at its front address.
 * @throws Error saying how many lessons there are and what to change in course.json
 */
export function standaloneLessonFolder(folders: readonly string[]): string {
  const lessons = courseLessonFolders(folders);
  const [only] = lessons;
  if (lessons.length === 1 && only !== undefined) return only;
  throw new Error(
    `course.json has "home": "lesson", but the course has ${lessons.length} lessons (${lessons.join(', ')}). Set "home": "landing" to list them.`,
  );
}

/**
 * The lesson whose page is also index.html, or undefined when index.html is the landing
 * page.
 * @throws Error from standaloneLessonFolder() for "lesson" with more than one lesson
 */
export function frontPageLesson(folders: readonly string[], home: CourseHome): string | undefined {
  return home === 'lesson' ? standaloneLessonFolder(folders) : undefined;
}
