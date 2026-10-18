import { describe, expect, inject, it } from "vitest";
import { Person, probe } from "./people";

// Hangout spreads by link: an invite in a group chat, a sign-in link sent to
// your own phone. Chat apps fetch a link to draw its preview card, as a
// stranger with no cookies. So a shared link must make a card (a title and a
// description, in Open Graph tags), and fetching it must change nothing: a
// preview bot can't join a group or sign anyone in.

const baseUrl = inject("baseUrl");

const og = (doc: Document, prop: string) =>
  doc.querySelector(`meta[property="og:${prop}"]`)?.getAttribute("content") ?? "";

async function invite() {
  const ana = new Person(baseUrl, probe("Ana"));
  const name = probe("Chat crew");
  const res = await ana.post("/api/groups", { group: name, name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  return { ana, name, path };
}

describe("a link pasted into a chat", () => {
  it("an invite makes a preview card that names the group it's an invite to", async () => {
    const { name, path } = await invite();
    const { doc } = await new Person(baseUrl).get(path);
    expect(og(doc, "title")).toContain(name);
    expect(og(doc, "description").length, "a line under the title").toBeGreaterThan(20);
    expect(og(doc, "site_name")).toBe("Hangout");
    expect(og(doc, "url"), "the card links to the page itself").toBe(new URL(path, baseUrl).href);
  });

  it("drawing the preview joins nobody: the group still has one member", async () => {
    const { ana, path } = await invite();
    await new Person(baseUrl).get(path);
    await new Person(baseUrl).get(path);
    // the People tab's count, which shows whether or not Ana has answered
    const { doc } = await ana.get(path);
    expect(doc.querySelector('a[data-tab="people"] .count')?.textContent?.trim()).toBe("1");
  });

  it("every page has a card, so the home page shared on its own makes one too", async () => {
    const { doc } = await new Person(baseUrl).get("/");
    expect(og(doc, "title")).not.toBe("");
    expect(og(doc, "type")).toBe("website");
  });
});
