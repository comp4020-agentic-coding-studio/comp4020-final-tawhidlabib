import { describe, expect, inject, it } from "vitest";
import { Person, probe } from "./people";

// Smarter availability: copy last week's hours in one tap, nudge someone who
// hasn't marked theirs (once a week, not a nag), and hear when a stretch
// opens up that the whole group shares.

const baseUrl = inject("baseUrl");

async function groupOfTwo() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Smart crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  return { ana, ben, path, id };
}

const notes = async (p: Person, pattern: RegExp) =>
  [...(await p.get("/inbox")).doc.querySelectorAll("#inbox li.note")].filter((li) => pattern.test(li.textContent ?? ""));

describe("smarter availability", () => {
  it("copies last week's hours into this one", async () => {
    const { ana, path, id } = await groupOfTwo();
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18", "2030-01-08T19"] });
    expect((await ana.post(`/api/groups/${id}/copy-week`, { week: "2030-01-14" })).status).toBe(303);
    const { doc } = await ana.get(`${path}?week=2030-01-14`);
    expect(doc.querySelector<HTMLInputElement>('input[name="slot"][value="2030-01-15T18"]')?.checked).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[name="slot"][value="2030-01-15T19"]')?.checked).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[name="slot"][value="2030-01-15T20"]')?.checked).toBe(false);
  });

  it("nudges someone who hasn't marked their week, once", async () => {
    const { ana, ben, path, id } = await groupOfTwo();
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] });
    const { doc } = await ana.get(`${path}?week=2030-01-07`);
    const nudge = [...doc.querySelectorAll("#people-body tr")]
      .find((tr) => tr.textContent?.includes(ben.name))
      ?.querySelector<HTMLFormElement>('form[action$="/nudge"]');
    expect(nudge, "Ben hasn't marked anything, so he can be nudged").toBeTruthy();
    const member = nudge?.querySelector<HTMLInputElement>('input[name="member"]')?.value ?? "";

    expect((await ana.post(`/api/groups/${id}/nudge`, { member, week: "2030-01-07" })).status).toBe(303);
    await ana.post(`/api/groups/${id}/nudge`, { member, week: "2030-01-07" });
    expect(await notes(ben, /nudged/), "one nudge a week, however many taps").toHaveLength(1);
  });

  it("tells everyone when a stretch opens up that the whole group shares, once", async () => {
    const { ana, ben, id } = await groupOfTwo();
    const tuesday = ["2030-01-08T18", "2030-01-08T19", "2030-01-08T20"];
    await ana.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: tuesday });
    expect(await notes(ana, /everyone's free/i), "not until everyone is").toHaveLength(0);
    await ben.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: tuesday });
    expect(await notes(ana, /everyone's free/i)).toHaveLength(1);
    expect(await notes(ben, /everyone's free/i)).toHaveLength(1);

    await ben.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: tuesday });
    expect(await notes(ana, /everyone's free/i), "and not again for the same stretch").toHaveLength(1);
  });
});
