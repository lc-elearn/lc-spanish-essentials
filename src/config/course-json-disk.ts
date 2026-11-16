/**
 * course-json-disk.ts — course.json's `home` setting, read from disk under Node (TODO
 * §E55). The dev-server plugin reads it per request, as it reads the lesson folders, so a
 * changed setting needs a reload and not a restart. The browser tests read it to know
 * what index.html should be.
 *
 * Node only (`node:fs`), and alias-free: vite.config.ts reaches it through
 * lo-dev-pages.ts (AGENTS.md hard constraint 1). The browser bundle never imports it; it
 * has course.config.ts.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseCourseHome, type CourseHome } from './course-home';

/** The course's settings file, at the repo root. */
export const COURSE_JSON_PATH = path.resolve(import.meta.dirname, '../../course.json');

/** The course's `home`, read from `file` now. */
export function readCourseHome(file: string = COURSE_JSON_PATH): CourseHome {
  return parseCourseHome(JSON.parse(readFileSync(file, 'utf8')));
}
