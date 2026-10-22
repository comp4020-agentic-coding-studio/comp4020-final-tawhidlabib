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
