/**
 * posix-path.ts — a native file path with forward slashes, whatever the OS.
 *
 * On Windows, `path.relative` and `path.join` return backslashes
 * (`lo-config\lo-01-…\lo.json`). Code that compares such a path with a `/` string
 * (`startsWith('lo-config/')`, `endsWith('docs/STYLE.md')`) is then false on Windows
 * only, which Linux CI never sees (issue #85). Convert first, then compare.
 *
 * Only for paths that are compared or shown. A path handed back to Node or Vite
 * (`readFileSync`, `addWatchFile`) stays native.
 *
 * `sep` defaults to the running OS's separator; the tests pass `path.win32.sep` to
 * check the Windows case on any machine. Node-safe and alias-free, like the rest of
 * `src/build/` (AGENTS.md, hard constraint 1).
 */
import path from 'node:path';

export function toPosixPath(file: string, sep: string = path.sep): string {
  return file.split(sep).join('/');
}
