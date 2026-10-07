import { describe, expect, inject, it } from "vitest";
import { Person, probe, signedUp } from "./people";

// After the hangout: once a plan's day has come, its people can add photos
// to a shared album and say how it was. Photos are checked to be images,
// kept under 5 MB, and shown only to the people the plan is for.

const baseUrl = inject("baseUrl");

// A real 1×1 PNG.
const PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="),
  (c) => c.charCodeAt(0),
);
const photo = { name: "beach.png", type: "image/png", bytes: PNG };

async function pastHangout() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Memory crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop();
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  const title = probe("Beach day");
  await ana.post(`/api/groups/${id}/hangouts`, { date: "2026-01-10", start: "10", end: "14", title });
  // past hangouts are listed on the group page
  const card = [...(await ben.get(path)).doc.querySelectorAll("#plans-body article")].find((a) =>
    a.textContent?.includes(title),
  );
  const ref = card?.querySelector("[data-thread]")?.getAttribute("data-thread")?.split(":")[1] ?? "";
  return { ana, ben, path, ref, title };
}

const albumOf = async (p: Person, path: string, title: string) => {
  const card = [...(await p.get(path)).doc.querySelectorAll("#plans-body article")].find((a) =>
    a.textContent?.includes(title),
  );
  return [...(card?.querySelectorAll<HTMLImageElement>(".album img") ?? [])];
};

describe("after the hangout", () => {
  it("a past hangout's people can add photos, and only they can see them", async () => {
    const { ana, ben, path, ref, title } = await pastHangout();
    expect(ref, "the past hangout is on the group page").not.toBe("");
    expect((await ana.upload("/api/photos", { kind: "hangout", ref }, [photo])).status).toBe(303);

    const [img] = await albumOf(ben, path, title);
    expect(img, "Ben sees Ana's photo").toBeTruthy();
    const src = img?.getAttribute("src") ?? "";
    const seen = await fetch(new URL(src, baseUrl), { headers: { cookie: ben.cookie } });
    expect(seen.status).toBe(200);
    expect(seen.headers.get("content-type")).toBe("image/png");
    expect((await fetch(new URL(src, baseUrl))).status, "a stranger can't").toBe(403);
  });

  it("only images, and nothing over 5 MB", async () => {
    const { ana, path, ref, title } = await pastHangout();
    const fake = { name: "virus.png", type: "image/png", bytes: new TextEncoder().encode("<script>alert(1)</script>") };
    expect((await ana.upload("/api/photos", { kind: "hangout", ref }, [fake])).status).toBe(415);
    const huge = new Uint8Array(5 * 1024 * 1024 + 1);
    huge.set(PNG);
    expect((await ana.upload("/api/photos", { kind: "hangout", ref }, [{ ...photo, bytes: huge }])).status).toBe(413);
    expect(await albumOf(ana, path, title)).toHaveLength(0);
  });

  it("photos wait until the day comes", async () => {
    const ana = await signedUp(baseUrl, "Ana");
    const res = await ana.post("/api/events", {
      title: probe("Future"),
      date: "2030-02-01",
      start: "12:00",
      end: "13:00",
      visibility: "public",
    });
    const shareId = (res.headers.get("location") ?? "").split("/").pop() ?? "";
    expect((await ana.upload("/api/photos", { kind: "event", ref: shareId }, [photo])).status).toBe(409);
  });

  it("everyone says how it was, one rating each", async () => {
    const { ana, ben, path, ref, title } = await pastHangout();
    await ben.post("/api/ratings", { kind: "hangout", ref, score: "5" });
    await ana.post("/api/ratings", { kind: "hangout", ref, score: "3" });
    const card = async () =>
      [...(await ana.get(path)).doc.querySelectorAll("#plans-body article")].find((a) => a.textContent?.includes(title));
    expect((await card())?.querySelector(".rating")?.textContent).toMatch(/4\.0/);
    await ben.post("/api/ratings", { kind: "hangout", ref, score: "5" });
    expect((await card())?.querySelector(".rating")?.textContent, "tapping yours again takes it back").toMatch(/3\.0/);
  });

  it("you can delete your own photo, and nobody else can", async () => {
    const { ana, ben, path, ref, title } = await pastHangout();
    await ana.upload("/api/photos", { kind: "hangout", ref }, [photo]);
    const card = [...(await ana.get(path)).doc.querySelectorAll("#plans-body article")].find((a) =>
      a.textContent?.includes(title),
    );
    const del = card?.querySelector('.album form[action$="/delete"]')?.getAttribute("action") ?? "";
    expect(del).not.toBe("");
    expect((await ben.post(del)).status).toBe(403);
    expect((await ana.post(del)).status).toBe(303);
    expect(await albumOf(ana, path, title)).toHaveLength(0);
  });

  it("adding a photo tells the plan's people", async () => {
    const { ana, ben, ref, title } = await pastHangout();
    await ana.upload("/api/photos", { kind: "hangout", ref }, [photo]);
    const notes = [...(await ben.get("/inbox")).doc.querySelectorAll("#inbox li.note")].map((li) => li.textContent ?? "");
    expect(notes.some((n) => n.includes(title) && /photo/i.test(n))).toBe(true);
  });
});
