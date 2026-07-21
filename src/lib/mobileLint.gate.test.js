import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

// The deploy-gate lint globalIgnores 'mobile' and vitest excludes 'mobile/**',
// so nothing gated the mobile app: a bare no-undef (the CreateApptModal
// `settings` ReferenceError) shipped in an OTA and silently broke every
// appointment create. Fail the root suite if mobile lint reports any error.
//
// Runs mobile's own pinned eslint binary — `npx eslint` would fall back to
// the root's different eslint major and crash on mobile's config. Skips (with
// a warning) in checkouts that never installed mobile deps, e.g. web-only
// parallel worktrees; any tree that ships mobile code has the binary.
const mobile = path.resolve(__dirname, '../../mobile');
const eslintBin = path.join(mobile, 'node_modules', '.bin', 'eslint');

describe('mobile lint gate', () => {
  if (!existsSync(eslintBin)) {
    // eslint-disable-next-line no-console
    console.warn('[mobileLint.gate] skipped — run `npm install` in mobile/ to enable the gate');
  }
  it.skipIf(!existsSync(eslintBin))('mobile/src has no eslint errors', () => {
    try {
      execFileSync(eslintBin, ['src', '--quiet'], { cwd: mobile, stdio: 'pipe', timeout: 120_000 });
    } catch (e) {
      throw new Error(`eslint errors in mobile/src:\n${e.stdout?.toString() || e.stderr?.toString() || e.message}`);
    }
  }, 150_000);
});
