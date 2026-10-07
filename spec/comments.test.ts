import { describe, expect, inject, it } from "vitest";
import { befriend, Person, probe, signedUp } from "./people";

// Comments and reactions on plans: events and hangouts both. The talk
// belongs to the plan, and only people the plan is for can join in --- an
// event's guests (anyone, if it's public), a hangout's group.

const baseUrl = inject("baseUrl");

const thread = (doc: Document, ref: string) => doc.querySelector(`[data-thread="${ref}"]`);
const commentsIn = (doc: Document, ref: string) =>
  [...(thread(doc, ref)?.querySelectorAll(".comment") ?? [])].map((c) => c.textContent ?? "");
// Found by comparing values, not by a [value="🎉"] selector: JSDOM's selector
// engine doesn't match emoji outside the basic plane in attribute selectors.
const countOf = (doc: Document, ref: string, emoji: string) =>
  [...(thread(doc, ref)?.querySelectorAll<HTMLButtonElement>('button[name="emoji"]') ?? [])]
    .find((b) => b.value === emoji)
    ?.querySelector(".count")
    ?.textContent?.trim() || "0";

/** A private event Ana hosts with Ben invited. */
async function privateEvent() {
  const ana = await signedUp(baseUrl, "Ana");
  const ben = await signedUp(baseUrl, "Ben");
  await befriend(ana, ben);
  const { doc } = await ana.get("/events/new");
  const label = [...doc.querySelectorAll("label")].find((l) => l.textContent?.includes(ben.name));
  const invite = label?.querySelector<HTMLInputElement>('input[name="invite"]')?.value ?? "";
  const res = await ana.post("/api/events", {
    title: probe("Picnic"),
    date: "2030-01-12",
    start: "12:00",
    end: "15:00",
    visibility: "private",
    invite,
  });
  const path = res.headers.get("location") ?? "";
  return { ana, ben, path, ref: `event:${path.split("/").pop()}`, shareId: path.split("/").pop() ?? "" };
}

describe("comments and reactions on events", () => {
  it("a guest's comment shows on the event for everyone it's for", async () => {
    const { ana, ben, path, shareId, ref } = await privateEvent();
    const words = probe("I'll bring the blanket");
    const res = await ben.post("/api/comments", { kind: "event", ref: shareId, body: words });
    expect(res.status).toBe(303);

    const anas = (await ana.get(path)).doc;
    const said = commentsIn(anas, ref);
    expect(said.some((c) => c.includes(words) && c.includes(ben.name)), "Ana sees Ben's comment").toBe(true);
  });

  it("nobody outside a private event can comment on it", async () => {
    const { ana, path, shareId, ref } = await privateEvent();
    const outsider = await signedUp(baseUrl, "Outsider");
    const words = probe("let me in");
    expect((await outsider.post("/api/comments", { kind: "event", ref: shareId, body: words })).status).toBe(403);
    expect(commentsIn((await ana.get(path)).doc, ref).some((c) => c.includes(words))).toBe(false);
  });

  it("one reaction each: tapping another changes it, tapping yours again takes it back", async () => {
    const { ana, ben, path, shareId, ref } = await privateEvent();
    const react = (emoji: string) => ben.post("/api/reactions", { kind: "event", ref: shareId, emoji });

    expect((await react("❤️")).status).toBe(303);
    await react("🎉");
    let doc = (await ana.get(path)).doc;
    expect(countOf(doc, ref, "🎉")).toBe("1");
    expect(countOf(doc, ref, "❤️"), "changing your reaction replaces it").toBe("0");

    await react("🎉");
    doc = (await ana.get(path)).doc;
    expect(countOf(doc, ref, "🎉"), "tapping it again takes it back").toBe("0");
  });

  it("you can delete your own comment, but not someone else's", async () => {
    const { ana, ben, path, shareId, ref } = await privateEvent();
    const words = probe("oops");
    await ana.post("/api/comments", { kind: "event", ref: shareId, body: words });
    const own = (await ana.get(path)).doc;
    const id = [...(thread(own, ref)?.querySelectorAll(".comment") ?? [])]
      .find((c) => c.textContent?.includes(words))
      ?.querySelector<HTMLFormElement>('form[action$="/delete"]')
      ?.getAttribute("action");
    expect(id, "your own comment has a delete button").toBeTruthy();

    expect((await ben.post(id ?? "")).status, "Ben can't delete Ana's comment").toBe(403);
    expect((await ana.post(id ?? "")).status).toBe(303);
    expect(commentsIn((await ana.get(path)).doc, ref).some((c) => c.includes(words))).toBe(false);
  });
});

describe("comments and reactions on hangouts", () => {
  it("the group can talk about a hangout and react to it, and nobody else can", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const created = await ana.post("/api/groups", {
      group: probe("Hiking crew"),
      name: ana.name,
      timezone: "Australia/Sydney",
    });
    const path = created.headers.get("location") ?? "";
    const groupId = path.split("/").pop();
    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${groupId}/join`, { name: ben.name });
    await ana.post(`/api/groups/${groupId}/hangouts`, {
      date: "2030-01-09",
      start: "9",
      end: "12",
      title: probe("Ridge walk"),
    });

    const page = `${path}?week=2030-01-07`;
    const rsvp = (await ben.get(page)).doc.querySelector('form[action^="/api/hangouts/"][action$="/rsvp"]');
    const hangoutId = rsvp?.getAttribute("action")?.split("/")[3] ?? "";
    const ref = `hangout:${hangoutId}`;

    const words = probe("Meet at the trailhead?");
    expect((await ben.post("/api/comments", { kind: "hangout", ref: hangoutId, body: words })).status).toBe(303);
    await ben.post("/api/reactions", { kind: "hangout", ref: hangoutId, emoji: "🙌" });

    const anas = (await ana.get(page)).doc;
    expect(commentsIn(anas, ref).some((c) => c.includes(words) && c.includes(ben.name))).toBe(true);
    expect(countOf(anas, ref, "🙌")).toBe("1");

    const outsider = await signedUp(baseUrl, "Outsider");
    expect(
      (await outsider.post("/api/comments", { kind: "hangout", ref: hangoutId, body: "hi" })).status,
      "someone outside the group can't comment",
    ).toBe(403);
    expect((await outsider.post("/api/reactions", { kind: "hangout", ref: hangoutId, emoji: "👍" })).status).toBe(403);
  });
});
