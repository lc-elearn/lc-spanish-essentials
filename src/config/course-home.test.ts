/**
 * course-home.test.ts — the `home` setting in course.json (TODO §E55): which page a
 * course opens on.
 */
import { describe, expect, it } from 'vitest';
import { CourseHomeSchema, parseCourseHome } from './course-home';

describe('CourseHomeSchema', () => {
  it('defaults to "landing", so a course.json without the key keeps its landing page', () => {
    expect(CourseHomeSchema.parse(undefined)).toBe('landing');
  });

  it('accepts "landing" and "lesson"', () => {
    expect(CourseHomeSchema.parse('landing')).toBe('landing');
    expect(CourseHomeSchema.parse('lesson')).toBe('lesson');
  });

  it('refuses any other value', () => {
    expect(CourseHomeSchema.safeParse('lessons').success).toBe(false);
  });
});

describe('parseCourseHome', () => {
  it('reads home from the whole course.json, ignoring the other keys', () => {
    expect(parseCourseHome({ courseTitle: 'X', home: 'lesson' })).toBe('lesson');
    expect(parseCourseHome({ courseTitle: 'X' })).toBe('landing');
  });

  it('names course.json and the field when the value is wrong', () => {
    expect(() => parseCourseHome({ home: 'single' })).toThrow(/course\.json is invalid[\s\S]*home/);
  });
});
