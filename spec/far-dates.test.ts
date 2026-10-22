import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";

// Weeks and months nobody will plan in: a far ?week= used to be a 500, and
// ?month=0000-01 froze the server (an endless loop over days). Hotfixed
// alone from the gold round (spec/edges.test.ts there holds the rest).

const baseUrl = inject("baseUrl");

async function group(label = "Edge crew") {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe(label), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  return { ana, path, id: path.split("/").pop() ?? "" };
}

/** A GET that gives up after `ms`: a page that never answers must fail the
 *  test, not hang it. */
async function within(path: string, ms: number): Promise<number | "timed out"> {
  try {
    const res = await fetch(new URL(path, baseUrl), { signal: AbortSignal.timeout(ms), redirect: "manual" });
    await res.text();
    return res.status;
  } catch {
    return "timed out";
  }
}

describe("a week or month nobody will plan in", () => {
  it("?week= far from now shows this week instead of failing", async () => {
    const { ana, path } = await group();
    const here = (await ana.get(path)).doc;
    const thisWeek = textOf(here, ".week-nav strong");
    for (const week of ["9999-12-27", "9999-12-20", "0001-01-01", "2099-01-05"]) {
      const page = await ana.get(`${path}?week=${week}`);
      expect(page.res.status, `?week=${week}`).toBe(200);
      expect(textOf(page.doc, ".week-nav strong"), `?week=${week} falls back to this week`).toBe(thisWeek);
    }
    // within reach still means what it says
    const near = await ana.get(`${path}?week=2030-01-07`);
    expect(textOf(near.doc, ".week-nav strong")).toBe("Week of Mon 7 Jan");
  });

  it("saving hours for a week far from now is refused, like a day that isn't a Monday", async () => {
    const { ana, id } = await group();
    for (const action of ["availability", "copy-week"]) {
      expect((await ana.post(`/api/groups/${id}/${action}`, { week: "9999-12-27" })).status, action).toBe(400);
    }
  });

  it("?month= far from now shows this month, and answers quickly", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const thisMonth = textOf((await ana.get("/calendar")).doc, "h1");
    for (const month of ["0000-01", "9999-12", "1900-01"]) {
      // 0000-01 used to loop until the server ran out of memory
      expect(await within(`/calendar?month=${month}`, 5000), `?month=${month}`).toBe(200);
      expect(textOf((await ana.get(`/calendar?month=${month}`)).doc, "h1"), `?month=${month}`).toBe(thisMonth);
    }
    expect(textOf((await ana.get("/calendar?month=2030-01")).doc, "h1")).toBe("January 2030");
  });
});
