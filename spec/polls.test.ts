import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp, textOf } from "./people";

// Polls on plans: "Pizza or tacos?" asked on a hangout or an event, voted
// on by the plan's people, single or multiple choice, closed by whoever
// asked.

const baseUrl = inject("baseUrl");

async function hangoutOfTwo() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Poll crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop();
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  await ana.post(`/api/groups/${id}/hangouts`, { date: "2030-01-09", start: "18", end: "20", title: probe("Dinner") });
  const page = `${path}?week=2030-01-07`;
  const ref =
    (await ben.get(page)).doc
      .querySelector('form[action^="/api/hangouts/"][action$="/rsvp"]')
      ?.getAttribute("action")
      ?.split("/")[3] ?? "";
  return { ana, ben, page, ref };
}

/** The poll asking `question` on a page, and each option's vote count. */
function poll(doc: Document, question: string) {
  const card = [...doc.querySelectorAll(".poll")].find((p) => p.querySelector(".poll-question")?.textContent?.includes(question));
  const options = [...(card?.querySelectorAll<HTMLButtonElement>('button[name="option"]') ?? [])].map((b) => ({
    id: b.value,
    label: b.querySelector(".option-label")?.textContent?.trim() ?? "",
    votes: Number(b.querySelector(".votes")?.textContent?.trim() || 0),
  }));
  const action = card?.querySelector<HTMLFormElement>('form[action$="/vote"]')?.getAttribute("action") ?? "";
  const close = card?.querySelector<HTMLFormElement>('form[action$="/close"]')?.getAttribute("action") ?? "";
  return { card, options, action, close, count: (label: string) => options.find((o) => o.label === label)?.votes ?? 0 };
}

describe("polls on plans", () => {
  it("someone asks, the group votes, and changing your vote moves it", async () => {
    const { ana, ben, page, ref } = await hangoutOfTwo();
    const question = probe("Where should we eat?");
    const asked = await ana.post("/api/polls", { kind: "hangout", ref, question, option: ["Pizza", "Tacos", ""] });
    expect(asked.status).toBe(303);

    let p = poll((await ben.get(page)).doc, question);
    expect(p.options.map((o) => o.label), "blank options are dropped").toEqual(["Pizza", "Tacos"]);
    const tacos = p.options.find((o) => o.label === "Tacos")?.id ?? "";
    const pizza = p.options.find((o) => o.label === "Pizza")?.id ?? "";

    expect((await ben.post(p.action, { option: tacos })).status).toBe(303);
    p = poll((await ana.get(page)).doc, question);
    expect(p.count("Tacos")).toBe(1);

    await ben.post(p.action, { option: pizza });
    p = poll((await ana.get(page)).doc, question);
    expect([p.count("Pizza"), p.count("Tacos")], "one vote each in a single-choice poll").toEqual([1, 0]);
  });

  it("in a multiple-choice poll you can pick several, and tapping one again takes it back", async () => {
    const { ana, ben, page, ref } = await hangoutOfTwo();
    const question = probe("Which nights work?");
    await ana.post("/api/polls", { kind: "hangout", ref, question, option: ["Fri", "Sat"], multi: "on" });
    let p = poll((await ben.get(page)).doc, question);
    const [fri, sat] = p.options.map((o) => o.id);
    await ben.post(p.action, { option: fri });
    await ben.post(p.action, { option: sat });
    p = poll((await ana.get(page)).doc, question);
    expect([p.count("Fri"), p.count("Sat")]).toEqual([1, 1]);
    await ben.post(p.action, { option: sat });
    p = poll((await ana.get(page)).doc, question);
    expect(p.count("Sat")).toBe(0);
  });

  it("whoever asked can close it, and then nobody can vote", async () => {
    const { ana, ben, page, ref } = await hangoutOfTwo();
    const question = probe("Bring a jacket?");
    await ana.post("/api/polls", { kind: "hangout", ref, question, option: ["Yes", "No"] });
    let p = poll((await ana.get(page)).doc, question);
    expect(poll((await ben.get(page)).doc, question).close, "only the asker can close it").toBe("");
    expect((await ana.post(p.close)).status).toBe(303);
    p = poll((await ben.get(page)).doc, question);
    expect(p.card?.textContent).toMatch(/closed/i);
    expect((await ben.post(p.action || `/api/polls/0/vote`, { option: p.options[0]?.id ?? "" })).status).not.toBe(303);
  });

  it("only the plan's people can ask or vote, and asking tells them", async () => {
    const { ana, ben, ref } = await hangoutOfTwo();
    const outsider = await signedUp(baseUrl, "Outsider");
    expect((await outsider.post("/api/polls", { kind: "hangout", ref, question: "hi?", option: ["a", "b"] })).status).toBe(403);
    const question = probe("Movie after?");
    await ana.post("/api/polls", { kind: "hangout", ref, question, option: ["Yes", "No"] });
    expect(textOf((await ben.get("/inbox")).doc, "#inbox")).toContain(question);
  });

  it("a poll needs a question and two options", async () => {
    const { ana, page, ref } = await hangoutOfTwo();
    const question = probe("Lonely?");
    await ana.post("/api/polls", { kind: "hangout", ref, question, option: ["Only one"] });
    expect(poll((await ana.get(page)).doc, question).card).toBeUndefined();
  });
});
