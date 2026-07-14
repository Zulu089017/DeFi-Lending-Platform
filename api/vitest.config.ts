import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    // testcontainers startup is 5-15s on first run; allow generous timeouts
    testTimeout: 60_000,
    hookTimeout: 60_000,
    // `forks` avoids the Prisma WASM-loader issue with `threads`; singleFork
    // serialises tests so the one globalSetup container isn't raced.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    globalSetup: ["./src/tests/helpers/global-setup.ts"],
    setupFiles: ["./src/tests/helpers/setup-env.ts"],
    include: ["src/tests/**/*.test.ts"],
  },
});
