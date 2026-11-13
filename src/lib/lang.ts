/**
 * lang.ts — the course's TARGET language code, in ONE place.
 *
 * WHAT: Re-exports `courseConfig.languageCode` as `TARGET_LANG` so every exercise
 * engine imports a single constant instead of reaching into course.config.
 *
 * WHY (WCAG 3.1.2 — Language of Parts): `<html lang="en">` in index.html declares
 * the UI-chrome language. Learner-facing content is the TARGET language (e.g. "es"),
 * so screen readers must be told to switch pronunciation for it. Engines wrap only
 * their target-language content subtrees in `lang={TARGET_LANG}`; UI chrome
 * (Check/Reset/status/aria) inherits `lang="en"`.
 *
 * Spec: docs/specs/lo-semantic-structure.md §3.
 */
import { courseConfig } from '../config/course.config';

/** The language being taught (e.g. "es"). Wrap learner content, never UI chrome. */
export const TARGET_LANG = courseConfig.languageCode;

/** The learner's own language, which is also the UI language (`<html lang="en">`). */
export const NATIVE_LANG = 'en';

const LANGUAGE_NAMES = new Intl.DisplayNames([NATIVE_LANG], { type: 'language' });

/**
 * A language's name in English, the UI language: "ru" → "Russian" (E63, spec §5).
 * One lookup for every label that names a language: the vocabulary block's "Hide
 * Russian" and flashcards' "Russian to English". Falls back to the code itself, and
 * never throws: `Intl.DisplayNames` throws on a malformed code, and this module is
 * imported by every page.
 */
export function languageName(code: string): string {
  try {
    return LANGUAGE_NAMES.of(code) ?? code;
  } catch {
    return code;
  }
}

/** The course language's English name, e.g. "Spanish". */
export const TARGET_LANGUAGE_NAME = languageName(TARGET_LANG);
/** The learner's language's English name: "English". */
export const NATIVE_LANGUAGE_NAME = languageName(NATIVE_LANG);
