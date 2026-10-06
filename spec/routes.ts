// The routes the quality floor runs against. When you add a page, add its
// route here, or the floor stops covering it.
export const ROUTES = ["/", "/readme/"];

// A page behind a dynamic segment can't be named in a static list, so these
// are made fresh each run: a new group, as a stranger holding its invite link
// sees it, as its member does, and once there's an overlap to recommend and a
// hangout to answer. A new state or a new dynamic page gets a line here too.
export async function dynamicRoutes(
  baseUrl: string,
): Promise<{ label: string; path: string; cookie?: string }[]> {
  const post = (path: string, fields: string[][], cookie?: string) =>
    fetch(new URL(path, baseUrl), {
      method: "POST",
      headers: { origin: baseUrl, ...(cookie ? { cookie } : {}) },
      body: new URLSearchParams(fields),
      redirect: "manual",
    });
  const cookieFrom = (res: Response) =>
    res.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .find((c) => c.startsWith("hg_"));

  const created = await post("/api/groups", [
    ["group", "Quality floor"],
    ["name", "Floor"],
    ["timezone", "Australia/Sydney"],
  ]);
  const path = created.headers.get("location") ?? "/g/not-created";
  const id = path.split("/").pop();
  const floor = cookieFrom(created);
  const wall = cookieFrom(await post(`/api/groups/${id}/join`, [["name", "Wall"]]));

  // A future week, so its hours are still recommendable.
  const week = "2030-01-07";
  const evening = ["18", "19", "20", "21"].map((h) => ["slot", `2030-01-08T${h}`]);
  for (const cookie of [floor, wall]) {
    await post(`/api/groups/${id}/availability`, [["week", week], ...evening], cookie);
  }
  await post(
    `/api/groups/${id}/hangouts`,
    [
      ["date", "2030-01-08"],
      ["start", "18"],
      ["end", "20"],
      ["title", "Floor check"],
    ],
    floor,
  );

  return [
    { label: "/g/[id], invited", path },
    { label: "/g/[id], member", path, cookie: floor },
    { label: "/g/[id], with plans", path: `${path}?week=${week}`, cookie: floor },
  ];
}
