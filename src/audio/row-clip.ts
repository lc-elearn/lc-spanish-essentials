/**
 * row-clip.ts — tap anywhere on a row to hear its clip (E62).
 *
 * A row that carries its own clip plays it when clicked or tapped anywhere on the row,
 * not only on the speaker. The row PRESSES its own speaker button rather than playing
 * the clip itself: the speaker already owns playback (what is playing, the progress
 * ring, stopping every other clip), so a second entry point into the audio layer would
 * be a second source of truth for the same fact. Ported from the vocabulary block's
 * `playRowClip`, itself from french-lo-1's `PhraseTable`.
 *
 * A MOUSE AND TOUCH CONVENIENCE ONLY. The row gets no role, tabIndex or key handler:
 * the speaker <button> is the keyboard and screen-reader path, and a second tab stop
 * per row would announce every word twice for nothing.
 *
 * Spec: docs/specs/2026-11-12-row-click-audio-design.md.
 */
import type { MouseEvent } from 'react';

/** Set on the speaker <button> (CircularAudioProgressAnimatedSpeakerDisplay). */
export const ROW_CLIP_SPEAKER_ATTRIBUTE = 'data-row-clip-speaker';

/**
 * Rows with a clip carry `data-row-clip`, written as a literal JSX attribute in each
 * component (a JSX attribute name cannot be a constant); tests and the browser test find
 * clip rows by this selector.
 */
export const ROW_CLIP_ROW_SELECTOR = '[data-row-clip]';

/**
 * The look of a row with a clip. A row WITHOUT one gets neither: a pointer over a row
 * that does nothing is a promise the page cannot keep.
 *
 * NO `transition-colors`. Rows such as inline-gap and line-match declare `bg-card` and
 * `border-border/70` in their base state, and TODO §D8 says never to transition a token
 * colour declared in a base state: after a light/dark toggle the colours would animate
 * or stick. The hover snaps instead, as the header links do (see the note at the top of
 * src/components/shell/header.css).
 */
export const ROW_CLIP_CLASSES = 'cursor-pointer hover:bg-muted';

/** Anything inside a row that does its own job when clicked. */
const CONTROL_SELECTOR = [
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  'label',
  '[contenteditable]:not([contenteditable="false"])',
  '[draggable="true"]',
  '[role="button"]',
  '[role="link"]',
  '[role="checkbox"]',
  '[role="switch"]',
  '[role="combobox"]',
  '[role="option"]',
  '[role="slider"]',
].join(',');

/**
 * Whether a click on `target` inside `row` should play the row's clip.
 *
 * No when: the row has no marked speaker; the target is not in the row; text is
 * selected (a drag to select a sentence ends in a click, and a plain click has already
 * collapsed any old selection on mousedown); or the click landed on a control INSIDE
 * the row. The containment check matters: a row can sit inside a focusable or
 * interactive ancestor, which must not swallow every click on it.
 */
export function shouldPlayRowClip(
  target: EventTarget | null,
  row: Element,
  selectedText: string,
): boolean {
  if (selectedText !== '') return false;
  if (row.querySelector(`[${ROW_CLIP_SPEAKER_ATTRIBUTE}]`) === null) return false;
  if (!(target instanceof Element) || !row.contains(target)) return false;
  const control = target.closest(CONTROL_SELECTOR);
  return control === null || control === row || !row.contains(control);
}

/** A row's `onClick`: press the row's own speaker when §4 of the spec allows it. */
export function playRowClip(event: MouseEvent<HTMLElement>): void {
  const row = event.currentTarget;
  const selectedText = window.getSelection()?.toString() ?? '';
  if (!shouldPlayRowClip(event.target, row, selectedText)) return;
  row.querySelector<HTMLElement>(`[${ROW_CLIP_SPEAKER_ATTRIBUTE}]`)?.click();
}
