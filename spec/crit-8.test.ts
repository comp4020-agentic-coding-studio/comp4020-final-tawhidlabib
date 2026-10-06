import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Crit 8 (It's alive!) — the checkable lines of its published spec:
// https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/08-its-alive/
//
// Held elsewhere, not here: the *.fly.dev deploy (CI's deploy job checks it
// answers; network checks stay out of `pnpm check`), the repo going public
// (ship), PROCESS.md and reflections/crit-8.md (`pnpm check:evidence`), and
// publishing README.md at /readme/ (invariants.test.ts, readme-full.test.ts).
// Still to write: "a stranger can do the core thing and find their trace when
// they come back", once the core thing is decided.

describe("crit 8: a first version of what good means is in README.md", () => {
  const readme = readFileSync("README.md", "utf8");

  it("has replaced the template's README", () => {
    expect(readme, "README.md still carries the template's instructions").not.toContain(
      "<!-- TEMPLATE",
    );
    expect(readme, "README.md still has the template's heading").not.toMatch(
      /^#\s+Your app\s*$/m,
    );
  });
});
