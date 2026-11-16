/**
 * posix-path.test.ts — a native path becomes a forward-slash path on every OS.
 *
 * The bug this guards (issue #85) only shows on Windows, where `path.relative` and
 * `path.join` return backslashes. CI runs on Linux, so these tests build the Windows
 * path with `path.win32` and pass its separator explicitly: the conversion is checked
 * on any machine, not only the one where it matters.
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { toPosixPath } from './posix-path';

describe('toPosixPath', () => {
  it('turns a Windows path into forward slashes', () => {
    const windows = path.win32.join('lo-config', 'lo-01-greetings', 'lo.json');
    expect(windows).toBe('lo-config\\lo-01-greetings\\lo.json');
    expect(toPosixPath(windows, path.win32.sep)).toBe('lo-config/lo-01-greetings/lo.json');
  });

  it('keeps a Windows drive path whole', () => {
    expect(toPosixPath('C:\\Users\\richard\\Sites\\course\\docs\\STYLE.md', '\\')).toBe(
      'C:/Users/richard/Sites/course/docs/STYLE.md',
    );
  });

  it('leaves a POSIX path as it is', () => {
    const posix = path.posix.join('docs', 'culp-syllabi', 'README.md');
    expect(toPosixPath(posix, path.posix.sep)).toBe('docs/culp-syllabi/README.md');
  });

  // A path holding both separators, so a default other than `path.sep` gives a different
  // answer on every OS, not only on Windows.
  it("uses the running OS's separator by default", () => {
    expect(toPosixPath('a\\b/c')).toBe(toPosixPath('a\\b/c', path.sep));
    expect(toPosixPath(path.join('.claude', 'skills', 'README.md'))).toBe(
      '.claude/skills/README.md',
    );
  });
});
