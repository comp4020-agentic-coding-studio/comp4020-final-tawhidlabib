import { defineConfig } from "vitest/config";

// Two kinds of test, run together by `pnpm test`:
// - spec/ checks the RUNNING app over HTTP, which spec/global-setup.ts finds.
// - unit/ calls the pure functions in src/lib directly: no server, no
//   database, nothing to wait for. `pnpm test:unit` runs only these.
// A test anywhere else needs adding to an `include`.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "spec",
          include: ["spec/**/*.test.ts"],
          globalSetup: ["./spec/global-setup.ts"],
          // Five spec files each launch a real Chrome in beforeAll, in
          // parallel. On CI's small runner that startup alone can pass the
          // 10 s default, which failed three files before any test ran
          // ("Hook timed out in 10000ms"). Setup gets a minute; every
          // assertion keeps its own limit.
          hookTimeout: 60_000,
        },
      },
      {
        test: {
          name: "unit",
          include: ["unit/**/*.test.ts"],
          // Fly's machines run in UTC; a developer's laptop usually doesn't.
          // Pinning it means a date helper that leaned on the machine's own
          // zone fails here, not only in production.
          env: { TZ: "UTC" },
        },
      },
    ],
  },
});
