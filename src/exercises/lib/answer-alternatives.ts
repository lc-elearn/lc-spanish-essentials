/**
 * answer-alternatives.ts — the answers a typed answer accepts (TODO §E54; spec
 * docs/specs/2026-11-10-typed-answer-alternatives-design.md §3).
 *
 * `|` means "or" in every typed answer: `[в семейном кругу|в кругу семьи::hint]` in an
 * inline-gap, `"answer": "обеспеченные|состоятельные"` in typed-transform, dictation and
 * conjugation. Any number of alternatives; the FIRST is the preferred answer (Show answers
 * fills it in). Nothing else in the codebase splits a typed answer on `|`; a choice blank's
 * `|` is a different syntax, read by `splitChoiceOptions` in parsing.ts.
 *
 * An empty part is kept as `''` so the load checks (answer-checks.ts, parsing.ts) can
 * name it; grading never meets one, because the build refuses it.
 */

/** The accepted answers in a typed answer, in authored order: split on `|`, each trimmed. */
export function splitAlternatives(answer: string): string[] {
  return answer.split('|').map((alternative) => alternative.trim());
}
