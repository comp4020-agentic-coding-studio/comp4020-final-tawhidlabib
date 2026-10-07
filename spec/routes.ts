import { befriend, friendCode, Person } from "./people";

// The routes the quality floor runs against. When you add a page, add its
// route here, or the floor stops covering it. These are as a stranger sees
// them, with no cookies.
export const ROUTES = [
  "/",
  "/readme/",
  "/groups",
  "/calendar",
  "/events",
  "/events/new",
  "/friends",
  "/me",
];

type Page = { label: string; path: string; cookie?: string };

// A page behind a dynamic segment, or one that looks different to someone
// signed in, can't be named in a static list, so these are made fresh each
// run: a small world --- a host with a profile, friends, a group with an
// overlap and a hangout, a public and a private event --- and every page as
// each of its people sees it. A new state or a new page gets a line here.
export async function dynamicRoutes(baseUrl: string): Promise<Page[]> {
  const host = new Person(baseUrl, "Floor");
  const created = await host.post("/api/groups", {
    group: "Quality floor",
    name: host.name,
    timezone: "Australia/Sydney",
  });
  const path = created.headers.get("location") ?? "/g/not-created";
  const id = path.split("/").pop();

  // a second member who joins by the link, and becomes a friend
  const wall = new Person(baseUrl, "Wall");
  await wall.post(`/api/groups/${id}/join`, { name: wall.name });
  await befriend(host, wall);
  // and someone whose friend request is still waiting
  const door = new Person(baseUrl, "Door");
  await door.post("/api/me", { name: door.name, timezone: "Australia/Sydney" });
  await door.post("/api/friends", { code: await friendCode(host) });

  // A future week, so its hours are still recommendable.
  const week = "2030-01-07";
  const evening = ["18", "19", "20", "21"].map((h) => `2030-01-08T${h}`);
  for (const p of [host, wall]) {
    await p.post(`/api/groups/${id}/availability`, { week, slot: evening });
  }
  await host.post(`/api/groups/${id}/hangouts`, {
    date: "2030-01-08",
    start: "18",
    end: "20",
    title: "Floor check",
  });

  const when = { date: "2030-01-10", start: "19:00", end: "22:00", location: "The pier" };
  const open = await host.post("/api/events", {
    ...when,
    title: "Floor party",
    details: "Bring snacks",
    visibility: "public",
  });
  const party = open.headers.get("location") ?? "/e/not-created";
  const closed = await host.post("/api/events", { ...when, title: "Floor secret", visibility: "private" });
  const secret = closed.headers.get("location") ?? "/e/not-created";
  await host.post(`/api/events${secret.slice(2)}/invite`, { inviteGroup: id ?? "" });

  // threads with something in them: a comment and reactions on the event and
  // on the hangout
  const partyRef = party.split("/").pop() ?? "";
  await host.post("/api/comments", { kind: "event", ref: partyRef, body: "Who's bringing music?" });
  await host.post("/api/reactions", { kind: "event", ref: partyRef, emoji: "🎉" });
  const plans = (await wall.get(`${path}?week=${week}`)).doc;
  const hangoutRef =
    plans.querySelector('form[action^="/api/hangouts/"][action$="/rsvp"]')?.getAttribute("action")?.split("/")[3] ?? "";
  await wall.post("/api/comments", { kind: "hangout", ref: hangoutRef, body: "I'll book a table" });
  await wall.post("/api/reactions", { kind: "hangout", ref: hangoutRef, emoji: "🙌" });

  // a full event with someone waiting (ADR 6)
  const tiny = await host.post("/api/events", { ...when, title: "Floor dinner", visibility: "public", capacity: "1" });
  const dinner = tiny.headers.get("location") ?? "/e/not-created";
  const dinnerRef = dinner.split("/").pop() ?? "";
  await wall.post(`/api/events/${dinnerRef}/rsvp`, { response: "going" });
  await door.post(`/api/events/${dinnerRef}/rsvp`, { response: "going" });

  const { html } = await host.get("/me");
  const signIn = /\/me\/sign-in\/[A-Za-z0-9_-]+/.exec(html)?.[0] ?? "/me/sign-in/missing";

  const as = (person: Person) => person.cookie;
  // a group member by the group's own cookie only, as before profiles
  const memberCookie = [...host.jar].filter(([k]) => k.startsWith("hg_")).map(([k, v]) => `${k}=${v}`)[0];

  return [
    { label: "/g/[id], invited", path },
    { label: "/g/[id], member", path, cookie: memberCookie },
    { label: "/g/[id], with plans", path: `${path}?week=${week}`, cookie: as(host) },
    { label: "/g/[id], people", path: `${path}?week=${week}#people`, cookie: as(wall) },
    { label: "/g/[id], join as yourself", path, cookie: as(door) },
    { label: "home, signed in", path: "/", cookie: as(host) },
    { label: "/groups, signed in", path: "/groups", cookie: as(host) },
    { label: "/calendar, with plans", path: "/calendar?month=2030-01&day=2030-01-08", cookie: as(host) },
    { label: "/events, signed in", path: "/events", cookie: as(wall) },
    { label: "/events/new, with friends", path: "/events/new", cookie: as(host) },
    { label: "/friends, with requests", path: "/friends", cookie: as(host) },
    { label: "/me, signed in", path: "/me", cookie: as(host) },
    { label: "/e/[id], host", path: party, cookie: as(host) },
    { label: "/e/[id], stranger", path: party },
    { label: "/e/[id], private, invited", path: secret, cookie: as(wall) },
    { label: "/e/[id], full, with a waitlist", path: dinner, cookie: as(host) },
    { label: "/e/[id], full, as the one waiting", path: dinner, cookie: as(door) },
    { label: "/events, a search", path: "/events?q=Floor" },
    { label: "/f/[code], stranger", path: `/f/${await friendCode(host)}` },
    { label: "/f/[code], signed in", path: `/f/${await friendCode(host)}`, cookie: as(door) },
    { label: "/me/sign-in/[token], another device", path: signIn },
  ];
}
