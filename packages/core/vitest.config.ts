import { defineConfig } from 'vitest/config';

// The golden tests compare tens of thousands of solver steps in one synchronous test (about 80 s), so the
// default 5 s timeout, which Vitest 5 now enforces on synchronous tests too, has to be raised.
export default defineConfig({ test: { include: ['test/**/*.test.ts'], testTimeout: 600_000, hookTimeout: 600_000 } });
