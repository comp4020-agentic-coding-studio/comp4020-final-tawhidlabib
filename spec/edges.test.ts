import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";
import { readEventForm } from "../src/lib/eventForm.ts";
import { tidy } from "../src/lib/names.ts";
import { clockSpan, endDate } from "../src/lib/time.ts";

// The edges the audit found the app falling off (docs/hd-audit-2026-10-19.md
// #8, #15, #22, #23): weeks and months nobody will ever plan in, spot limits
// that aren't numbers, an event that runs past midnight, event dates in the
// past or ages away, names that look the same but aren't the same bytes, a
// blank rename, a taken name on a second device, and inputs with no limit.

const baseUrl = inject("baseUrl");

/** Today's date where `tz` is, the way the app reckons it. */
const todayIn = (tz: string, plusDays = 0) =>
  new Date(Date.now() + plusDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: tz });

async function group(label = "Edge crew") {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe(label), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  return { ana, path, id: path.split("/").pop() ?? "" };
}

// Weeks and months far from now: spec/far-dates.test.ts (shipped as a hotfix first).

/** An event's form, with sensible defaults. */
const EVENT = { date: "2030-01-10", start: "19:00", end: "21:00", visibility: "public" };

describe("an event's spot limit and +1s", () => {
  it("empty means no limit; zero, negative, fractional or not a number is an error", async () => {
    const host = await signedUp(baseUrl, "Host");
    const open = await host.post("/api/events", { ...EVENT, title: probe("Open"), capacity: "" });
    expect(open.headers.get("location"), "empty is unlimited").toMatch(/^\/e\//);
    for (const capacity of ["0", "-3", "abc", "2.5", "1e3"]) {
      const res = await host.post("/api/events", { ...EVENT, title: probe("Spots"), capacity });
      expect(res.headers.get("location"), `capacity ${capacity}`).toBe("/events/new?error=event-capacity");
    }
    const page = await host.get("/events/new?error=event-capacity");
    expect(textOf(page.doc, '.event-form [role="alert"]')).toMatch(/spots/i);
  });

  it("+1s outside 0 to 3 are an error, not quietly changed", async () => {
    const host = await signedUp(baseUrl, "Host");
    for (const maxPlusOnes of ["-1", "4", "two", "1.5"]) {
      const res = await host.post("/api/events", { ...EVENT, title: probe("Plus"), maxPlusOnes });
      expect(res.headers.get("location"), `+1s ${maxPlusOnes}`).toBe("/events/new?error=event-plus-ones");
    }
    const ok = await host.post("/api/events", { ...EVENT, title: probe("Plus"), maxPlusOnes: "" });
    expect(ok.headers.get("location"), "no +1s chosen is none").toMatch(/^\/e\//);
  });

  it("editing an event to a bad limit is refused back to the edit form", async () => {
    const host = await signedUp(baseUrl, "Host");
    const made = await host.post("/api/events", { ...EVENT, title: probe("Edit spots"), capacity: "5" });
    const shareId = (made.headers.get("location") ?? "").split("/").pop() ?? "";
    const res = await host.post(`/api/events/${shareId}/edit`, { ...EVENT, title: "Edited", capacity: "0" });
    expect(res.headers.get("location")).toBe(`/e/${shareId}/edit?error=event-capacity`);
    expect(textOf((await host.get(`/e/${shareId}`)).doc, ".ev-pills"), "the limit is unchanged").toContain("5 of 5 spots left");
  });
});

describe("an event that runs past midnight", () => {
  async function overnight(fields: Record<string, string>) {
    const host = await signedUp(baseUrl, "Host");
    const title = probe("Late one");
    const res = await host.post("/api/events", { ...EVENT, title, ...fields });
    const path = res.headers.get("location") ?? "";
    return { host, title, res, path, shareId: path.split("/").pop() ?? "" };
  }

  it("10pm to 1am is accepted, and its calendar entries end the next day", async () => {
    // 10 Jan 2030 in Sydney is AEDT, UTC+11: 10pm is 11:00Z, 1am on the 11th is 14:00Z
    const { host, res, path, shareId } = await overnight({ start: "22:00", end: "01:00" });
    expect(path, "accepted").toMatch(/^\/e\//);
    expect(res.status).toBe(303);

    const ics = await fetch(new URL(`/api/events/${shareId}.ics`, baseUrl), { headers: { cookie: host.cookie } });
    const body = await ics.text();
    expect(body).toContain("DTSTART:20300110T110000Z");
    expect(body).toContain("DTEND:20300110T140000Z");

    const { doc } = await host.get(path);
    const google = [...doc.querySelectorAll<HTMLAnchorElement>("a[href^='https://calendar.google.com']")][0]?.href ?? "";
    expect(new URL(google).searchParams.get("dates")).toBe("20300110T110000Z/20300110T140000Z");
    expect(textOf(doc, ".ev-facts"), "the page says it ends the next day").toMatch(/10pm–1am \(next day\)/);
  });

  it("across the night the clocks go forward, the end is still the right instant", async () => {
    // Sydney springs forward at 2am on Sun 6 Oct 2030: 11pm Sat is 13:00Z
    // (AEST, UTC+10) and 4am Sun is 17:00Z (AEDT, UTC+11)
    const { host, shareId } = await overnight({ date: "2030-10-05", start: "23:00", end: "04:00" });
    const body = await (await fetch(new URL(`/api/events/${shareId}.ics`, baseUrl), { headers: { cookie: host.cookie } })).text();
    expect(body).toContain("DTSTART:20301005T130000Z");
    expect(body).toContain("DTEND:20301005T170000Z");
  });

  it("on the calendar and the events list, the time reads as running into the next day", async () => {
    const { host, title } = await overnight({ start: "22:00", end: "01:00" });
    const cal = (await host.get("/calendar?month=2030-01")).doc;
    expect(textOf(cal, '[data-date="2030-01-10"]')).toContain(title);
    expect(textOf(cal, "#up-next")).toMatch(/10pm–1am \(next day\)/);
    const card = [...(await host.get("/events")).doc.querySelectorAll("#yours .event-card")].find((c) => c.textContent?.includes(title));
    expect(card?.textContent ?? "").toMatch(/10pm–1am \(next day\)/);
  });

  it("a start and end at the same minute is still refused", async () => {
    const { path } = await overnight({ start: "20:00", end: "20:00" });
    expect(path).toBe("/events/new?error=event-time");
  });
});

describe("an event's date", () => {
  it("before today, where the host is, is refused with a reason", async () => {
    const host = await signedUp(baseUrl, "Host");
    for (const date of [todayIn("Australia/Sydney", -1), "2020-01-01"]) {
      const res = await host.post("/api/events", { ...EVENT, title: probe("Past"), date });
      expect(res.headers.get("location"), date).toBe("/events/new?error=event-date");
    }
    expect(textOf((await host.get("/events/new?error=event-date")).doc, '.event-form [role="alert"]')).toMatch(/today/i);
    const today = await host.post("/api/events", { ...EVENT, title: probe("Today"), date: todayIn("Australia/Sydney"), start: "23:00", end: "23:30" });
    expect(today.headers.get("location"), "today still works").toMatch(/^\/e\//);
  });

  it("more than five years ahead is refused", async () => {
    const host = await signedUp(baseUrl, "Host");
    for (const date of ["9999-12-31", todayIn("Australia/Sydney", 6 * 366)]) {
      const res = await host.post("/api/events", { ...EVENT, title: probe("Far"), date });
      expect(res.headers.get("location"), date).toBe("/events/new?error=event-date");
    }
  });

  it("an event whose day has gone can still be edited, as long as its date stays put", async () => {
    // a past event can't be made any more, so make one for today and hold
    // its date: the rule "an edit may keep the date it has" is what lets a
    // host fix a typo on last week's event
    const host = await signedUp(baseUrl, "Host");
    const date = todayIn("Australia/Sydney");
    const made = await host.post("/api/events", { ...EVENT, title: probe("Keep"), date, start: "23:00", end: "23:30" });
    const shareId = (made.headers.get("location") ?? "").split("/").pop() ?? "";
    const kept = await host.post(`/api/events/${shareId}/edit`, { ...EVENT, title: "Fixed typo", date, start: "23:00", end: "23:30" });
    expect(kept.headers.get("location"), "keeping the date is fine").toBe(`/e/${shareId}`);
    const moved = await host.post(`/api/events/${shareId}/edit`, { ...EVENT, title: "Moved back", date: "2020-01-01" });
    expect(moved.headers.get("location"), "moving it into the past is not").toBe(`/e/${shareId}/edit?error=event-date`);
  });

  it("an edit may keep a date that has gone, and only that date (with the clock fixed)", () => {
    // over HTTP "today" is always in range, so the rule is read here with a
    // date that has gone: the event was on 3 Jan, and it's now 10 Jan
    const form = (date: string) => {
      const f = new FormData();
      for (const [k, v] of Object.entries({ ...EVENT, title: "Fixed typo", date })) f.set(k, v);
      return f;
    };
    expect(readEventForm(form("2030-01-03"), { today: "2030-01-10", keep: "2030-01-03" })).toHaveProperty("fields");
    expect(readEventForm(form("2030-01-02"), { today: "2030-01-10", keep: "2030-01-03" })).toEqual({ error: "event-date" });
    expect(readEventForm(form("2030-01-03"), { today: "2030-01-10" }), "a new event can't").toEqual({ error: "event-date" });
    expect(readEventForm(form("2035-01-10"), { today: "2030-01-10" })).toHaveProperty("fields");
    expect(readEventForm(form("2035-01-11"), { today: "2030-01-10" }), "five years and a day").toEqual({ error: "event-date" });
  });

  it("an end at or before the start is the next day", () => {
    expect(endDate("2030-12-31", "22:00", "01:00")).toBe("2031-01-01");
    expect(endDate("2030-01-10", "19:00", "21:00")).toBe("2030-01-10");
    expect(clockSpan("19:00", "21:30")).toBe("7pm–9:30pm");
    expect(clockSpan("22:00", "00:00")).toBe("10pm–12am (next day)");
  });

  it("the form says how far ahead it goes", async () => {
    const host = await signedUp(baseUrl, "Host");
    const input = (await host.get("/events/new")).doc.querySelector<HTMLInputElement>('input[name="date"]');
    expect(input?.min).toBe(todayIn("Australia/Sydney"));
    expect(input?.max ?? "", "a max date on the picker").toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("a group hangout still takes a past date (decided in review; see plan-rules)", async () => {
    const { ana, id } = await group();
    const res = await ana.post(`/api/groups/${id}/hangouts`, { date: "2026-01-10", start: "10", end: "12", title: "Past plan" });
    expect(res.headers.get("location")).not.toContain("error=");
  });
});

describe("names that look the same are the same name", () => {
  // "Café" typed on a Mac (NFC) and pasted from elsewhere (NFD), with a
  // zero-width space, or in full-width letters: one name, four byte strings
  const looks = ["Caf\u00e9", "Cafe\u0301", "Caf\u00e9\u200b", "\uff23\uff41\uff46\u00e9", "Caf\u00e9\u00a0"];

  it("someone joining under a lookalike of a taken name is told it's taken", async () => {
    const { ana, id } = await group();
    const first = new Person(baseUrl, looks[0]);
    expect((await first.post(`/api/groups/${id}/join`, { name: looks[0] })).headers.get("location")).toBe(`/g/${id}`);
    for (const name of looks.slice(1)) {
      const other = new Person(baseUrl, name);
      const res = await other.post(`/api/groups/${id}/join`, { name });
      expect(res.headers.get("location"), JSON.stringify(name)).toBe(`/g/${id}?error=name-taken`);
    }
    const names = [...(await ana.get(`/g/${id}`)).doc.querySelectorAll('ul.avatars[aria-label="Members"] li')].map((li) => li.getAttribute("title") ?? "");
    expect(names.filter((n) => n.startsWith("Caf"))).toHaveLength(1);
  });

  it("the name shown is tidied too: no invisible characters, full-width letters folded", async () => {
    const { ana, id } = await group();
    const name = `\uff22\uff45\uff4e\u200b ${process.hrtime.bigint()}`;
    const ben = new Person(baseUrl, name);
    await ben.post(`/api/groups/${id}/join`, { name });
    const html = (await ana.get(`/g/${id}`)).html;
    expect(html).toContain(`Ben ${name.split(" ")[1]}`);
    expect(html).not.toContain("\u{200B}");
  });

  it("emoji built from joiners and tags survive the tidying", () => {
    // field() tidies every title and poll option too. "Woman technologist" is
    // woman + joiner + laptop, the flag of England is a black flag + tag
    // characters, "heart on fire" is heart + VS16 + joiner + fire: those
    // invisible parts must stay. A stray joiner or tag elsewhere goes.
    const keep = [
      "Coding \u{1F469}\u{200D}\u{1F4BB}",
      "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F} fans",
      "Hi \u{1F44D}\u{1F3FD}",
      "\u{2764}\u{FE0F}\u{200D}\u{1F525} night",
    ];
    for (const text of keep) expect(tidy(text), JSON.stringify(text)).toBe(text);
    expect(tidy("Ana\u{200D}")).toBe("Ana");
    expect(tidy("Ana\u{E0041}")).toBe("Ana");
    expect(tidy("\u{202E}Ana\u{FEFF}")).toBe("Ana");
  });

  it("a name that is only invisible characters is no name", async () => {
    const { id } = await group();
    const ghost = new Person(baseUrl);
    const res = await ghost.post(`/api/groups/${id}/join`, { name: "\u200b\u200d\u2060" });
    expect(res.headers.get("location")).toBe(`/g/${id}?error=name-missing`);
  });
});

describe("renaming yourself", () => {
  it("a blank or whitespace-only name says to pick one, and keeps the old name", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    for (const name of ["   ", "\u200b", ""]) {
      const res = await ana.post("/api/me", { name, back: "/me" });
      expect(res.headers.get("location"), JSON.stringify(name)).toBe("/me?error=name-missing");
    }
    const page = await ana.get("/me?error=name-missing");
    expect(textOf(page.doc, '[role="alert"]')).toMatch(/pick a name/i);
    expect(textOf(page.doc, "h1")).toBe(ana.name);
  });
});

describe("a taken name on a second device", () => {
  it("points a returning person to their sign-in link", async () => {
    const { id } = await group();
    const ben = new Person(baseUrl, probe("Ben"));
    await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    // Ben again, on his phone, with none of his cookies
    const phone = new Person(baseUrl, ben.name);
    const res = await phone.post(`/api/groups/${id}/join`, { name: ben.name });
    expect(res.headers.get("location")).toBe(`/g/${id}?error=name-taken`);
    const alert = textOf((await phone.get(res.headers.get("location") ?? "")).doc, '[role="alert"]');
    expect(alert).toMatch(/sign-in link/i);
    expect(alert).toMatch(/\/me/);
  });
});

describe("every text box in the event form has a limit", () => {
  it("text, number and textarea inputs on /events/new carry maxlength or max", async () => {
    const host = await signedUp(baseUrl, "Host");
    const form = (await host.get("/events/new")).doc.querySelector("form.event-form");
    const boxes = [...(form?.querySelectorAll("input[type=text], input[type=search], textarea") ?? [])];
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(box.getAttribute("maxlength"), box.getAttribute("name") ?? "").toMatch(/^\d+$/);
  });
});
