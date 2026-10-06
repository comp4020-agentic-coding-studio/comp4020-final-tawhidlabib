// The routes the quality floor runs against. When you add a page, add its
// route here, or the floor stops covering it.
export const ROUTES = ["/", "/readme/"];

// A page behind a dynamic segment can't be named in a static list, so these
// are made fresh each run: a new group, as a stranger holding its invite link
// sees it and as its member does. A new dynamic page gets a line here too.
export async function dynamicRoutes(
  baseUrl: string,
): Promise<{ label: string; path: string; cookie?: string }[]> {
  const res = await fetch(new URL("/api/groups", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams({ group: "Quality floor", name: "Floor", timezone: "Australia/Sydney" }),
    redirect: "manual",
  });
  const path = res.headers.get("location") ?? "/g/not-created";
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .find((c) => c.startsWith("hg_"));
  return [
    { label: "/g/[id], invited", path },
    { label: "/g/[id], member", path, cookie },
  ];
}
