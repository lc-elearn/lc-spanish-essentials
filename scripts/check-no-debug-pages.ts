// scripts/check-no-debug-pages.ts
/**
 * Fails (exit 1) when dist/ holds a debug page. Run by .github/workflows/pages.yml
 * before a course build is published (spec §3.1). The decision is
 * src/build/debug-pages-in.ts, which has the tests; this only reads the folder.
 */
import { readdirSync } from 'node:fs';
import { findDebugPages } from '../src/build/debug-pages-in';

const found = findDebugPages(readdirSync('dist'));
if (found.length > 0) {
  console.error(`dist/ holds debug pages and must not be published: ${found.join(', ')}`);
  process.exit(1);
}
console.log('dist/ holds no debug pages.');
