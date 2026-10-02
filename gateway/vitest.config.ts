import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Each test file runs in its own worker – but our tests share module-level
    // state (the in-memory store). We use a single thread so beforeEach/afterEach
    // control the server lifecycle cleanly without cross-file contamination.
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
