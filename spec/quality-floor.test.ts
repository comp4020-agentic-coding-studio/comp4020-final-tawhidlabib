import axe from "axe-core";
import { JSDOM } from "jsdom";
import { beforeAll, describe, expect, inject, it } from "vitest";
import { ROUTES } from "./routes";

// The quality floor, carried forward from crit 7: it runs against the RUNNING
// app that spec/global-setup.ts finds at APP_URL and fetches each route over
// HTTP. So it checks what is serving, not the source --- in CI that's the
// Docker image Fly deploys; locally, run it against `pnpm build && pnpm start`.
//
// These hold for any good website, whatever the week's brief asks — the
// week-specific contracts live in your own spec/*.test.ts alongside this
// file. The routes they cover come from spec/routes.ts; keep it current.
const baseUrl = inject("baseUrl");

for (const route of ROUTES) {
  describe(`invariants: ${route}`, () => {
    let status: number;
    let dom: JSDOM;
    let doc: Document;

    beforeAll(async () => {
      const res = await fetch(new URL(route, baseUrl));
      status = res.status;
      dom = new JSDOM(await res.text(), {
        url: new URL(route, baseUrl).href,
        runScripts: "outside-only",
        pretendToBeVisual: true,
      });
      doc = dom.window.document;
    });

    it("responds 200", () => {
      expect(status).toBe(200);
    });

    it("declares its language", () => {
      expect(doc.documentElement.getAttribute("lang")).toBeTruthy();
    });

    it("has a real title", () => {
      expect(doc.title.trim()).not.toBe("");
    });

    it("has a mobile viewport", () => {
      expect(doc.querySelector('meta[name="viewport"]')).toBeTruthy();
    });

    it("has a navigation landmark", () => {
      expect(doc.querySelector("nav")).toBeTruthy();
    });

    it("has exactly one top-level heading", () => {
      expect(doc.querySelectorAll("h1").length).toBe(1);
    });

    it("gives every image alt text", () => {
      for (const img of doc.querySelectorAll("img")) {
        expect(
          img.hasAttribute("alt"),
          `<img src="${img.getAttribute("src")}"> needs alt text`,
        ).toBe(true);
      }
    });

    it("has no axe violations", async () => {
      // The accessibility floor: axe-core's full rule set, run inside jsdom
      // so CI needs no browser. jsdom doesn't do layout, so the handful of
      // rules that need rendered geometry or computed colour are disabled —
      // checking those (axe in a real browser, or agent-browser against the
      // live page) is yours to wire up when the spec asks for it.
      const window = dom.window as unknown as {
        eval: (source: string) => void;
        axe: typeof axe;
      };
      window.eval(axe.source);
      const results = await window.axe.run(doc, {
        rules: {
          "color-contrast": { enabled: false },
          "link-in-text-block": { enabled: false },
        },
      });
      const violations = results.violations.map(
        ({ id, help, nodes }) =>
          `${id}: ${help} (${nodes.map((node) => node.target.join(" ")).join("; ")})`,
      );
      expect(violations).toEqual([]);
    });
  });
}
