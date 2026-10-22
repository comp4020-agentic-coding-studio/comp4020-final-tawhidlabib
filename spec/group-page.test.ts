import { describe, expect, inject, it } from "vitest";
import { Person, probe, textOf } from "./people";

// The group page keeps the README's promises: a best time says who it
// leaves out, as well as who it suits (README point 2), and only to someone
// who has answered for that week (ADR 10).

const baseUrl = inject("baseUrl");
const WEEK = "2030-01-07"; // a Monday
const TUE = "2030-01-08";

async function groupOfThree() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Leftout crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  const cat = new Person(baseUrl, probe("Cat"));
  await cat.post(`/api/groups/${id}/join`, { name: cat.name });
  return { ana, ben, cat, path, id };
}

describe("a best time says who it leaves out", () => {
  it("names the people it doesn't suit, beside the people it does", async () => {
    const { ana, ben, cat, path, id } = await groupOfThree();
    // Ana and Ben share Tuesday 6–9pm; Cat answers with a different hour
    for (const p of [ana, ben]) {
      await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`, `${TUE}T19`, `${TUE}T20`] });
    }
    await cat.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T10`] });
    const best = textOf((await ana.get(`${path}?week=${WEEK}`)).doc, "#best-body .best-card .who");
    expect(best, "who it suits").toContain(ben.name);
    expect(best, "and who it leaves out").toMatch(new RegExp(`not ${cat.name}`));
  });

  it("says everyone's free when nobody is left out", async () => {
    const { ana, ben, cat, path, id } = await groupOfThree();
    for (const p of [ana, ben, cat]) {
      await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`, `${TUE}T19`] });
    }
    const best = textOf((await ana.get(`${path}?week=${WEEK}`)).doc, "#best-body .best-card .who");
    expect(best).toMatch(/everyone's free/i);
    expect(best).not.toMatch(/\bnot\b/);
  });

  it("someone who hasn't answered sees no names at all, in or out", async () => {
    const { ana, ben, cat, path, id } = await groupOfThree();
    for (const p of [ana, ben]) {
      await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`, `${TUE}T19`] });
    }
    const { html } = await cat.get(`${path}?week=${WEEK}`);
    expect(html, "Cat hasn't answered: the blind grid holds").not.toMatch(/\bnot (you|Ana|Ben)/);
    expect(html).not.toContain(`not ${cat.name}`);
  });

  it("a one-hour stretch says one hour", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    for (const p of [ana, ben]) {
      await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    }
    const { html } = await ana.get(`${path}?week=${WEEK}`);
    expect(html).not.toMatch(/>1 hours</);
    expect(html).toMatch(/>1 hour</);
  });
});

describe("the everyone's-week table scrolls from the keyboard", () => {
  it("is a named, focusable region", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    for (const p of [ana, ben]) {
      await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    }
    const region = (await ana.get(`${path}?week=${WEEK}`)).doc.querySelector(".table-scroll");
    expect(region?.getAttribute("tabindex")).toBe("0");
    expect(region?.getAttribute("role")).toBe("region");
    expect(region?.getAttribute("aria-label") ?? "").toMatch(/everyone's week/i);
  });
});

describe("archiving asks first", () => {
  it("the archive button confirms before it locks the group; unarchiving doesn't need to", async () => {
    const { ana, path, id } = await groupOfThree();
    const form = (await ana.get(path)).doc.querySelector('form:has(input[name="action"][value="archive"])');
    expect(form, "the admin sees an archive form").not.toBeNull();
    expect(form?.getAttribute("data-confirm") ?? "", "it asks first").toMatch(/archive/i);
    await ana.post(`/api/groups/${id}/manage`, { action: "archive" });
    const back = (await ana.get(path)).doc.querySelector('form:has(input[name="action"][value="unarchive"])');
    expect(back, "and it can be undone").not.toBeNull();
  });
});

describe("keep your spot", () => {
  it("is offered after joining, copies the private link, dismisses with a cookie, and stays dismissed", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    // Ben has only just joined: his first page load carries the one-shot flash
    const first = (await ben.get(path)).doc.querySelector(".keep-spot");
    expect(first, "shown after joining").not.toBeNull();
    expect(first?.textContent).toMatch(/Keep your spot/);
    expect(first?.querySelector("[data-copy]")?.getAttribute("data-copy") ?? "", "copies his private sign-in link").toMatch(
      /\/me\/sign-in\//,
    );
    expect(first?.querySelector('a[href="/me"]'), "links to /me").not.toBeNull();
    // after his first save it's still there, until he dismisses it
    await ben.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    expect((await ben.get(`${path}?week=${WEEK}`)).doc.querySelector(".keep-spot")).not.toBeNull();
    // someone who hasn't saved or just joined doesn't get it
    expect((await ana.get(path)).doc.querySelector(".keep-spot"), "not before the first save").toBeNull();
    // dismiss: a plain form POST
    const form = (await ben.get(`${path}?week=${WEEK}`)).doc.querySelector('.keep-spot form[action="/api/keep-spot"]');
    expect(form, "dismiss works without JS").not.toBeNull();
    const res = await ben.post("/api/keep-spot", { back: path });
    expect(res.status).toBe(303);
    expect((await ben.get(`${path}?week=${WEEK}`)).doc.querySelector(".keep-spot"), "gone for good").toBeNull();
    // and it's about this browser, not everyone
    await ana.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    expect((await ana.get(`${path}?week=${WEEK}`)).doc.querySelector(".keep-spot"), "Ana still gets hers").not.toBeNull();
  });
});

describe("the recommendation explains its trade-off, and the propose forms fold away", () => {
  it("says the best time is short when a longer one suits fewer; an unanswered member sees none of it", async () => {
    const { ana, ben, cat, path, id } = await groupOfThree();
    // all three share Tue 6–7pm; only Ana and Ben share Wed 12–5pm
    for (const p of [ana, ben, cat]) await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`] });
    const wed = ["12", "13", "14", "15", "16"].map((h) => `2030-01-09T${h}`);
    for (const p of [ana, ben]) await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`, ...wed] });
    const { doc } = await ana.get(`${path}?week=${WEEK}`);
    expect(textOf(doc, "#best-body .tradeoff")).toMatch(/suits all 3, but only for 1 hour\./);
    // Dan joins and hasn't answered: the blind grid shows him no cards, so no line either
    const dan = new Person(baseUrl, probe("Dan"));
    await dan.post(`/api/groups/${id}/join`, { name: dan.name });
    const blind = await dan.get(`${path}?week=${WEEK}`);
    expect(blind.doc.querySelector(".tradeoff"), "nothing derived from others' hours").toBeNull();
    expect(blind.html).not.toMatch(/but only for/);
  });

  it("keeps the propose form open on the best card and behind a disclosure on the others", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    for (const p of [ana, ben]) {
      await p.post(`/api/groups/${id}/availability`, { week: WEEK, slot: [`${TUE}T18`, `${TUE}T19`, "2030-01-09T10"] });
    }
    const cards = [...(await ana.get(`${path}?week=${WEEK}`)).doc.querySelectorAll("#best-body .card")];
    expect(cards.length).toBeGreaterThan(1);
    expect(cards[0].querySelector("form.propose"), "form on the best card").not.toBeNull();
    expect(cards[0].querySelector("details"), "not folded").toBeNull();
    for (const card of cards.slice(1)) {
      expect(card.querySelector("details.propose-more form.propose"), "folded on the others").not.toBeNull();
      expect(card.querySelector("details > summary")?.textContent).toMatch(/Propose this time/);
    }
  });
});

describe("how was it?", () => {
  it("the day after a hangout you were in, the next step asks how it was and links to its memories", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    const title = probe("Beach day");
    // yesterday in the group's timezone, so "the day after" is true whenever this runs
    const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString("en-CA", { timeZone: "Australia/Sydney" });
    await ana.post(`/api/groups/${id}/hangouts`, { date: yesterday, start: "10", end: "14", title });
    // the proposer is in; Ben hasn't been in anything yet
    const card = (p: Person) => p.get(path).then((r) => r.doc.querySelector("#next-step"));
    const next = await card(ana);
    expect(next?.textContent, "asks how it was").toContain(`How was ${title}?`);
    expect(next?.textContent).toMatch(/photos or a rating/i);
    expect(next?.querySelector('a[href="#plans"]'), "links to the plans tab, where its memories are").not.toBeNull();
    expect((await card(ben))?.textContent, "someone who wasn't in it isn't asked").not.toContain("How was");
    // rating it is the answer: the prompt goes away
    const ref = (await ana.get(path)).doc.querySelector("[data-thread]")?.getAttribute("data-thread")?.split(":")[1] ?? "";
    await ana.post("/api/ratings", { kind: "hangout", ref, score: "5" });
    expect((await card(ana))?.textContent).not.toContain("How was");
    // and a hangout from long ago is not nagged about
    const old = probe("Old day");
    await ben.post(`/api/groups/${id}/hangouts`, { date: "2026-01-10", start: "10", end: "14", title: old });
    expect((await card(ben))?.textContent).not.toContain(old);
  });
});
