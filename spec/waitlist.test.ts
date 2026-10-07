import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";
import { listen } from "./stream";

// The crit 9 decision (ADR 6): the last spot at a full event goes to whoever
// reaches the server first; everyone after is waitlisted and told at once;
// when someone drops out, the first person waiting moves in automatically
// and is notified. The host doesn't take a spot; +1s do.

const baseUrl = inject("baseUrl");

async function fullEvent(capacity: number, maxPlusOnes = 0) {
  const host = await signedUp(baseUrl, "Host");
  const res = await host.post("/api/events", {
    title: probe("Tiny dinner"),
    date: "2030-01-13",
    start: "19:00",
    end: "21:00",
    visibility: "public",
    capacity: String(capacity),
    maxPlusOnes: String(maxPlusOnes),
  });
  const path = res.headers.get("location") ?? "";
  return { host, path, shareId: path.split("/").pop() ?? "" };
}

const going = (p: Person, shareId: string, plusOnes = 0) =>
  p.post(`/api/events/${shareId}/rsvp`, { response: "going", plusOnes: String(plusOnes) });

const names = (doc: Document, section: string) =>
  [...doc.querySelectorAll(`${section} li`)].map((li) => li.textContent ?? "");

describe("the last spot at a full event (ADR 6)", () => {
  it("of five people tapping Going on the last spot at once, exactly one gets it", async () => {
    const { host, path, shareId } = await fullEvent(1);
    const crowd = await Promise.all([1, 2, 3, 4, 5].map((n) => signedUp(baseUrl, `Guest${n}`)));
    await Promise.all(crowd.map((p) => going(p, shareId)));

    const doc = (await host.get(path)).doc;
    const inside = crowd.filter((p) => textOf(doc, "#going").includes(p.name));
    const waiting = crowd.filter((p) => textOf(doc, "#waitlist").includes(p.name));
    expect(inside, "exactly one of them is going").toHaveLength(1);
    expect(waiting, "and the other four are waitlisted").toHaveLength(4);
  });

  it("the waitlist is in order, and the first person waiting moves in when someone drops out", async () => {
    const { host, path, shareId } = await fullEvent(1);
    const [first, second, third] = await Promise.all(["A", "B", "C"].map((n) => signedUp(baseUrl, n)));
    await going(first, shareId);
    await going(second, shareId);
    await going(third, shareId);

    let doc = (await host.get(path)).doc;
    expect(names(doc, "#waitlist").map((n) => n.includes(second.name) || n.includes(third.name))).toEqual([true, true]);
    expect(names(doc, "#waitlist")[0]).toContain(second.name);
    expect(textOf((await second.get(path)).doc, "#rsvp-h"), "the waitlisted are told so").toMatch(/waitlist/i);

    const seconds = await listen(second, ["person:me"]);
    await seconds.next((e) => e.event === "hello");
    await first.post(`/api/events/${shareId}/rsvp`, { response: "declined" });

    doc = (await host.get(path)).doc;
    expect(textOf(doc, "#going"), "the first person waiting moves in").toContain(second.name);
    expect(textOf(doc, "#waitlist")).toContain(third.name);
    expect(textOf(doc, "#waitlist")).not.toContain(second.name);
    await seconds.next((e) => e.event === "change", 1000);
    seconds.close();
  });

  it("+1s take spots too", async () => {
    const { host, path, shareId } = await fullEvent(2, 1);
    const [ana, ben] = await Promise.all(["Ana", "Ben"].map((n) => signedUp(baseUrl, n)));
    await going(ana, shareId, 1);
    await going(ben, shareId);
    const doc = (await host.get(path)).doc;
    expect(textOf(doc, "#going")).toContain(ana.name);
    expect(textOf(doc, "#waitlist"), "Ana and her +1 filled both spots").toContain(ben.name);
  });

  it("nobody else can take your spot by asking for more +1s than the host allows", async () => {
    const { host, path, shareId } = await fullEvent(3, 1);
    const ana = await signedUp(baseUrl, "Ana");
    await going(ana, shareId, 5);
    const ben = await signedUp(baseUrl, "Ben");
    await going(ben, shareId);
    expect(textOf((await host.get(path)).doc, "#going"), "Ana got 1 +1, not 5").toContain(ben.name);
  });

  it("a stranger can still see who's going to a public event", async () => {
    const { path } = await fullEvent(1);
    expect((await new Person(baseUrl).get(path)).doc.querySelector("#going")).not.toBeNull();
  });
});
