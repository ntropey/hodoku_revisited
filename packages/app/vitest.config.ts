import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// The puzzle bank and all-steps tests run the solver across many puzzles (10+ s on slow machines),
// so the default 5 s timeout, which Vitest 5 now enforces on synchronous tests too, has to be raised.
export default defineConfig({
  plugins: [react()],
  test: { include: ['test/**/*.test.ts'], testTimeout: 120_000, hookTimeout: 120_000 },
});
