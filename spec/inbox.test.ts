import { describe, expect, inject, it } from "vitest";
import { befriend, friendCode, Person, probe, signedUp, textOf } from "./people";
import { listen } from "./stream";

// The inbox: what happened while you weren't looking, waiting for you. The
// bell counts what you haven't read, live; opening an item marks it read
// and takes you to it; and your notifications are yours alone.

const baseUrl = inject("baseUrl");

const items = (doc: Document) => [...doc.querySelectorAll("#inbox li.note")];
const unread = (doc: Document) => items(doc).filter((li) => li.classList.contains("unread"));
const bell = (doc: Document) => doc.querySelector("#bell")?.getAttribute("aria-label") ?? "";

describe("the inbox", () => {
  it("a friend request lands in the inbox, and the bell counts it", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await ben.post("/api/friends", { code: await friendCode(ana) });

    const doc = (await ana.get("/inbox")).doc;
    expect(items(doc).some((li) => li.textContent?.includes(ben.name))).toBe(true);
    expect(bell(doc)).toMatch(/1 unread/);
  });

  it("opening an item takes you to it and marks it read", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const ben = await signedUp(baseUrl, "Ben");
    await befriend(ana, ben);
    const { doc: form } = await ana.get("/events/new");
    const invite = [...form.querySelectorAll("label")]
      .find((l) => l.textContent?.includes(ben.name))
      ?.querySelector<HTMLInputElement>('input[name="invite"]')?.value;
    const title = probe("Board games");
    await ana.post("/api/events", {
      title,
      date: "2030-01-14",
      start: "18:00",
      end: "21:00",
      visibility: "private",
      invite: invite ?? "",
    });

    let doc = (await ben.get("/inbox")).doc;
    const note = items(doc).find((li) => li.textContent?.includes(title));
    expect(note?.classList.contains("unread"), "Ben has an unread invite").toBe(true);
    const open = note?.querySelector("a")?.getAttribute("href") ?? "";
    const res = await ben.get(open);
    expect(res.res.status).toBe(303);
    expect(res.res.headers.get("location")).toMatch(/^\/e\//);

    doc = (await ben.get("/inbox")).doc;
    expect(
      items(doc).find((li) => li.textContent?.includes(title))?.classList.contains("unread"),
      "opened, it's read",
    ).toBe(false);

    expect((await ana.get(open)).res.status, "and nobody else can open Ben's").toBe(404);
  });

  it("a comment on a hangout tells the rest of the group, not the person who wrote it", async () => {
    const ana = new Person(baseUrl, probe("Ana"));
    const res = await ana.post("/api/groups", { group: probe("Inbox crew"), name: ana.name, timezone: "Australia/Sydney" });
    const path = res.headers.get("location") ?? "";
    const id = path.split("/").pop();
    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    await ana.post(`/api/groups/${id}/hangouts`, { date: "2030-01-09", start: "18", end: "20", title: probe("Tacos") });
    const hangoutId =
      (await ben.get(`${path}?week=2030-01-07`)).doc
        .querySelector('form[action^="/api/hangouts/"][action$="/rsvp"]')
        ?.getAttribute("action")
        ?.split("/")[3] ?? "";

    expect(items((await ben.get("/inbox")).doc).some((li) => li.textContent?.includes(ana.name)), "the proposal told Ben").toBe(true);
    const words = probe("I'll bring salsa");
    await ben.post("/api/comments", { kind: "hangout", ref: hangoutId, body: words });
    expect(items((await ana.get("/inbox")).doc).some((li) => li.textContent?.includes(ben.name))).toBe(true);
    expect(textOf((await ben.get("/inbox")).doc, "#inbox"), "Ben isn't told about his own comment").not.toContain(
      "commented",
    );
  });

  it("the bell updates live, and 'mark all read' clears it", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const anas = await listen(ana, ["person:me"]);
    await anas.next((e) => e.event === "hello");
    const ben = await signedUp(baseUrl, "Ben");
    await ben.post("/api/friends", { code: await friendCode(ana) });
    await anas.next((e) => e.event === "change", 1000);
    anas.close();

    expect(unread((await ana.get("/inbox")).doc).length).toBeGreaterThan(0);
    expect((await ana.post("/api/inbox/read-all")).status).toBe(303);
    const doc = (await ana.get("/inbox")).doc;
    expect(unread(doc)).toHaveLength(0);
    expect(bell(doc)).not.toMatch(/unread/);
  });

  it("someone moved in from a waitlist is told in their inbox", async () => {
    const host = await signedUp(baseUrl, "Host");
    const res = await host.post("/api/events", {
      title: probe("Tiny"),
      date: "2030-01-15",
      start: "19:00",
      end: "20:00",
      visibility: "public",
      capacity: "1",
    });
    const shareId = (res.headers.get("location") ?? "").split("/").pop();
    const [first, second] = await Promise.all(["First", "Second"].map((n) => signedUp(baseUrl, n)));
    await first.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    await second.post(`/api/events/${shareId}/rsvp`, { response: "going" });
    await first.post(`/api/events/${shareId}/rsvp`, { response: "declined" });
    expect(textOf((await second.get("/inbox")).doc, "#inbox")).toMatch(/spot/i);
  });

  it("the inbox asks a stranger to sign up first", async () => {
    const { doc } = await new Person(baseUrl).get("/inbox");
    expect(doc.querySelector('form[action="/api/me"]')).not.toBeNull();
  });
});
