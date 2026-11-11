/**
 * course-lessons.test.ts — the course's own lessons, and the one a `home: "lesson"` course
 * opens on (TODO §E55).
 */
import { describe, expect, it } from 'vitest';
import {
  courseLessonFolders,
  EXAMPLE_LO_FOLDER,
  frontPageLesson,
  standaloneLessonFolder,
} from './course-lessons';

describe('courseLessonFolders', () => {
  it('is the example alone while it is the only lesson, as in the template', () => {
    expect(courseLessonFolders([EXAMPLE_LO_FOLDER])).toEqual([EXAMPLE_LO_FOLDER]);
  });

  it('leaves the example out once the course has a lesson of its own', () => {
    expect(courseLessonFolders([EXAMPLE_LO_FOLDER, 'lo-01-greetings'])).toEqual([
      'lo-01-greetings',
    ]);
  });

  it('keeps course order: the lo-NN- number, compared as a number', () => {
    expect(courseLessonFolders(['lo-10-later', EXAMPLE_LO_FOLDER, 'lo-9-earlier'])).toEqual([
      'lo-9-earlier',
      'lo-10-later',
    ]);
  });
});

describe('standaloneLessonFolder', () => {
  it("is the course's one lesson", () => {
    expect(standaloneLessonFolder([EXAMPLE_LO_FOLDER, 'lo-01-greetings'])).toBe('lo-01-greetings');
  });

  it('is the example in the template, where it is the only lesson', () => {
    expect(standaloneLessonFolder([EXAMPLE_LO_FOLDER])).toBe(EXAMPLE_LO_FOLDER);
  });

  it('refuses two lessons, naming them and the setting to change', () => {
    expect(() =>
      standaloneLessonFolder([EXAMPLE_LO_FOLDER, 'lo-01-greetings', 'lo-02-food']),
    ).toThrow(
      'course.json has "home": "lesson", but the course has 2 lessons (lo-01-greetings, lo-02-food). Set "home": "landing" to list them.',
    );
  });
});

describe('frontPageLesson', () => {
  const FOLDERS = [EXAMPLE_LO_FOLDER, 'lo-01-greetings', 'lo-02-food'];

  it('is no lesson for "landing": the front page is the list of lessons', () => {
    expect(frontPageLesson(FOLDERS, 'landing')).toBeUndefined();
  });

  it('is the one lesson for "lesson"', () => {
    expect(frontPageLesson([EXAMPLE_LO_FOLDER, 'lo-01-greetings'], 'lesson')).toBe(
      'lo-01-greetings',
    );
  });

  it('throws for "lesson" with more than one lesson', () => {
    expect(() => frontPageLesson(FOLDERS, 'lesson')).toThrow(/Set "home": "landing"/);
  });
});
