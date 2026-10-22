import { describe, expect, it } from "vitest";
import { field, safeBack } from "../src/lib/forms";

// safeBack() is the only way a form's "go back to" value becomes a
// redirect (CLAUDE.md: never redirect to a raw form value). Each refusal
// below is a way a crafted form could send someone off-site.

describe("safeBack()", () => {
  it("keeps a path on this site, query and hash included", () => {
    expect(safeBack("/g/abc?week=2030-01-07#grid")).toBe("/g/abc?week=2030-01-07#grid");
    expect(safeBack("/")).toBe("/");
    expect(safeBack("/me", "/inbox")).toBe("/me");
  });

  it("returns what the URL parser made of it, dots resolved", () => {
    expect(safeBack("/a/../b")).toBe("/b");
    expect(safeBack("/./me")).toBe("/me");
    expect(safeBack("/café")).toBe("/caf%C3%A9");
  });

  it("refuses another site, however it's written", () => {
    for (const offsite of [
      "https://evil.example",
      "//evil.example",
      "//evil.example/g/abc",
      // browsers read a backslash as a slash
      "/\\evil.example",
      "\\\\evil.example",
      // the parser resolves these to //evil.example
      "/..//evil.example",
      "/.//evil.example",
      "javascript:alert(1)",
    ]) {
      expect(safeBack(offsite, "/fallback"), offsite).toBe("/fallback");
    }
  });

  it("refuses tabs, newlines and other control characters, which browsers drop from a URL", () => {
    for (const sneaky of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\u0000", "/\u007f", "/x\u001f"]) {
      expect(safeBack(sneaky, "/fallback"), JSON.stringify(sneaky)).toBe("/fallback");
    }
  });

  it("refuses anything that doesn't start with a slash", () => {
    for (const relative of ["evil.example", "g/abc", " /me", "", "?next=/me"]) {
      expect(safeBack(relative, "/fallback"), JSON.stringify(relative)).toBe("/fallback");
    }
  });

  it("falls back for a missing value or a file, to / by default", () => {
    expect(safeBack(null)).toBe("/");
    expect(safeBack(null, "/inbox")).toBe("/inbox");
    expect(safeBack(new File(["/me"], "back.txt"), "/inbox")).toBe("/inbox");
  });

  it("leaves an encoded slash encoded: a path segment, not a host", () => {
    expect(safeBack("/%2F%2Fevil.example")).toBe("/%2F%2Fevil.example");
  });
});

describe("field()", () => {
  it("trims, collapses runs of whitespace, and caps at max", () => {
    expect(field("  Ana   Lim \n", 40)).toBe("Ana Lim");
    expect(field("Movie\t\tnight", 40)).toBe("Movie night");
    expect(field("abcdefghij", 4)).toBe("abcd");
  });

  it("is empty for a missing field, a file, or only whitespace", () => {
    expect(field(null, 40)).toBe("");
    expect(field(new File(["Ana"], "name.txt"), 40)).toBe("");
    expect(field("   \n\t ", 40)).toBe("");
  });
});
