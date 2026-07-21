import { describe, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

// The deploy-gate lint globalIgnores 'mobile' and vitest excludes 'mobile/**',
// so nothing gated the mobile app: a bare no-undef (the CreateApptModal
// `settings` ReferenceError) shipped in an OTA and silently broke every
// appointment create. Fail the root suite if mobile lint reports any error.
describe('mobile lint gate', () => {
  it('mobile/src has no eslint errors', () => {
    const mobile = path.resolve(__dirname, '../../mobile');
    try {
      execFileSync('npx', ['eslint', 'src', '--quiet'], { cwd: mobile, stdio: 'pipe', timeout: 120_000 });
    } catch (e) {
      throw new Error(`eslint errors in mobile/src:\n${e.stdout?.toString() || e.message}`);
    }
  }, 150_000);
});
