/**
 * course-json-disk.test.ts — the Node reader of course.json's `home`, used by the dev
 * server and the browser tests (TODO §E55).
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COURSE_JSON_PATH, readCourseHome } from './course-json-disk';

function courseJson(content: object): string {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'course-json-')), 'course.json');
  writeFileSync(file, JSON.stringify(content));
  return file;
}

describe('readCourseHome', () => {
  it('reads "lesson" from a course.json that sets it', () => {
    expect(readCourseHome(courseJson({ courseTitle: 'X', home: 'lesson' }))).toBe('lesson');
  });

  it('reads "landing" from a course.json without the key', () => {
    expect(readCourseHome(courseJson({ courseTitle: 'X' }))).toBe('landing');
  });

  it("points at the repo's own course.json by default", () => {
    expect(path.basename(COURSE_JSON_PATH)).toBe('course.json');
    expect(() => readCourseHome()).not.toThrow();
  });
});
