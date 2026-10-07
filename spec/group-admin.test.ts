import { describe, expect, inject, it } from "vitest";
import { Person, probe, textOf } from "./people";

// Group management: whoever starts a group is its admin. The admin can
// rename it, remove someone (who then can't walk back in by the link), hand
// the admin role over, and archive it (read-only). Anyone can leave; an
// admin who leaves hands over to the longest-standing member.

const baseUrl = inject("baseUrl");

async function groupOfThree() {
  const ana = new Person(baseUrl, probe("Ana"));
  const res = await ana.post("/api/groups", { group: probe("Admin crew"), name: ana.name, timezone: "Australia/Sydney" });
  const path = res.headers.get("location") ?? "";
  const id = path.split("/").pop() ?? "";
  const ben = new Person(baseUrl, probe("Ben"));
  await ben.post(`/api/groups/${id}/join`, { name: ben.name });
  const cat = new Person(baseUrl, probe("Cat"));
  await cat.post(`/api/groups/${id}/join`, { name: cat.name });
  return { ana, ben, cat, path, id };
}

const manage = (p: Person, id: string, fields: Record<string, string>) => p.post(`/api/groups/${id}/manage`, fields);

/** A member's id, read off the People tab by name. */
async function memberId(viewer: Person, path: string, name: string) {
  const { doc } = await viewer.get(path);
  const row = [...doc.querySelectorAll("#people-body .person-row")].find((r) => r.textContent?.includes(name));
  return row?.getAttribute("data-member") ?? "";
}

const isMember = async (p: Person, path: string) => !!(await p.get(path)).doc.querySelector('input[name="slot"]');

describe("group management", () => {
  it("the creator is the admin, and only the admin can rename the group", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    const anaRow = [...(await ben.get(path)).doc.querySelectorAll("#people-body .person-row")].find((r) =>
      r.textContent?.includes(ana.name),
    );
    expect(anaRow?.textContent).toMatch(/admin/i);

    expect((await manage(ben, id, { action: "rename", name: "Hijacked" })).status).toBe(403);
    const name = probe("Renamed crew");
    expect((await manage(ana, id, { action: "rename", name })).status).toBe(303);
    expect(textOf((await ben.get(path)).doc, "h1")).toBe(name);
  });

  it("the admin can hand the role over", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    await manage(ana, id, { action: "admin", member: await memberId(ana, path, ben.name) });
    expect((await manage(ana, id, { action: "rename", name: "Nope" })).status, "Ana isn't admin any more").toBe(403);
    expect((await manage(ben, id, { action: "rename", name: probe("Ben's now") })).status).toBe(303);
  });

  it("someone the admin removes is out, and can't walk back in by the link", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    expect((await manage(ben, id, { action: "remove", member: await memberId(ben, path, ana.name) })).status).toBe(403);
    await manage(ana, id, { action: "remove", member: await memberId(ana, path, ben.name) });
    expect(await isMember(ben, path)).toBe(false);
    const back = await ben.post(`/api/groups/${id}/join`, { name: ben.name });
    expect(back.headers.get("location")).toMatch(/error=removed/);
    expect(await isMember(ben, path)).toBe(false);
  });

  it("anyone can leave, and an admin who leaves hands over to the longest-standing member", async () => {
    const { ana, ben, cat, path, id } = await groupOfThree();
    await manage(cat, id, { action: "leave" });
    expect(await isMember(cat, path)).toBe(false);
    await manage(ana, id, { action: "leave" });
    expect(await isMember(ana, path)).toBe(false);
    expect((await manage(ben, id, { action: "rename", name: probe("Ben's crew") })).status, "Ben is admin now").toBe(303);
  });

  it("an archived group is read-only, and sits apart on /groups", async () => {
    const { ana, ben, path, id } = await groupOfThree();
    expect((await manage(ben, id, { action: "archive" })).status).toBe(403);
    await manage(ana, id, { action: "archive" });

    const save = await ben.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] });
    expect(save.status, "no new hours in an archived group").toBe(409);
    expect((await ben.get(path)).doc.body.textContent).toMatch(/archived/i);
    expect((await ana.get("/groups")).doc.querySelector(`#archived a[href="${path}"]`)).not.toBeNull();

    await manage(ana, id, { action: "unarchive" });
    expect((await ben.post(`/api/groups/${id}/availability`, { week: "2030-01-07", slot: ["2030-01-08T18"] })).status).toBe(303);
  });
});
