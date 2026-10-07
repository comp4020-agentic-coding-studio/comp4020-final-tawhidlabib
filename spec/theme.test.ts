import { JSDOM } from "jsdom";
import { describe, expect, inject, it } from "vitest";

// The promise the theme picker makes: pick a colour (or light/dark) on any
// page, and the whole site comes back in it --- in this browser, on every
// page, without JavaScript. Held by what the server sends, so it doesn't
// depend on a script having run.

const baseUrl = inject("baseUrl");
const THEMES = ["sunset", "ocean", "forest", "grape", "rose"];

const choose = (fields: Record<string, string>) =>
  fetch(new URL("/api/theme", baseUrl), {
    method: "POST",
    headers: { origin: baseUrl },
    body: new URLSearchParams(fields),
    redirect: "manual",
  });

const cookiesFrom = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function root(cookie = "") {
  const res = await fetch(new URL("/", baseUrl), { headers: cookie ? { cookie } : {} });
  return new JSDOM(await res.text()).window.document;
}

describe("the theme picker", () => {
  it("offers every colour, and light and dark, on every page", async () => {
    for (const path of ["/", "/readme/"]) {
      const res = await fetch(new URL(path, baseUrl));
      const doc = new JSDOM(await res.text()).window.document;
      for (const theme of THEMES) {
        expect(
          doc.querySelector(`form[action="/api/theme"] button[name="theme"][value="${theme}"]`),
          `${path} should offer the ${theme} theme`,
        ).not.toBeNull();
      }
      for (const mode of ["system", "light", "dark"]) {
        expect(doc.querySelector(`button[name="mode"][value="${mode}"]`)).not.toBeNull();
      }
    }
  });

  it("takes you back where you were, and the site comes back in your colours", async () => {
    const theme = await choose({ theme: "ocean", back: "/readme/" });
    expect(theme.status).toBe(303);
    expect(theme.headers.get("location")).toBe("/readme/");

    const mode = await choose({ mode: "dark", back: "/" });
    const doc = await root(`${cookiesFrom(theme)}; ${cookiesFrom(mode)}`);
    expect(doc.documentElement.dataset.theme).toBe("ocean");
    expect(doc.documentElement.dataset.mode).toBe("dark");
  });

  it("falls back to the defaults for a theme it doesn't know, and never sends you off-site", async () => {
    const res = await choose({ theme: "<script>", back: "https://example.com/" });
    expect(res.headers.get("location")).toBe("/");

    const doc = await root("theme=%3Cscript%3E; mode=neon");
    expect(doc.documentElement.dataset.theme).toBe("sunset");
    expect(doc.documentElement.dataset.mode).toBe("system");
  });
});
