import { expect, test } from 'vitest';
import {
  languageName,
  NATIVE_LANG,
  NATIVE_LANGUAGE_NAME,
  TARGET_LANG,
  TARGET_LANGUAGE_NAME,
} from './lang';
import { courseConfig } from '../config/course.config';

test('TARGET_LANG mirrors the course languageCode', () => {
  expect(TARGET_LANG).toBe(courseConfig.languageCode);
});

test('TARGET_LANG is a non-empty language code', () => {
  expect(TARGET_LANG.length).toBeGreaterThanOrEqual(2);
});

// E63: the vocabulary block's "Hide {language}" and flashcards' face labels share one
// way of naming a language, in English (the UI language).
test('languageName gives the English name of a language code', () => {
  expect(languageName('ru')).toBe('Russian');
  expect(languageName('es')).toBe('Spanish');
  expect(languageName('en')).toBe('English');
});

test('languageName falls back to the code itself when Intl cannot name it', () => {
  expect(languageName('1x')).toBe('1x');
});

test('the course and learner language names follow the codes', () => {
  expect(TARGET_LANGUAGE_NAME).toBe(languageName(TARGET_LANG));
  expect(NATIVE_LANG).toBe('en');
  expect(NATIVE_LANGUAGE_NAME).toBe('English');
});
