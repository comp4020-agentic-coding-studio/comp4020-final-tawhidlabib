import type { AstroCookies } from "astro";

// The colour theme and light/dark mode a person picked, remembered in two
// cookies so the server can render the page in them from the first byte (no
// flash of the wrong colours, and it works without JavaScript).

export const THEMES = [
  { id: "sunset", label: "Sunset" },
  { id: "ocean", label: "Ocean" },
  { id: "forest", label: "Forest" },
  { id: "grape", label: "Grape" },
  { id: "rose", label: "Rose" },
] as const;

export const MODES = [
  { id: "system", label: "Auto" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
] as const;

export type Theme = (typeof THEMES)[number]["id"];
export type Mode = (typeof MODES)[number]["id"];

export const isTheme = (value: unknown): value is Theme =>
  THEMES.some((t) => t.id === value);
export const isMode = (value: unknown): value is Mode => MODES.some((m) => m.id === value);

export function themeOf(cookies: AstroCookies): { theme: Theme; mode: Mode } {
  const theme = cookies.get("theme")?.value;
  const mode = cookies.get("mode")?.value;
  return { theme: isTheme(theme) ? theme : "sunset", mode: isMode(mode) ? mode : "system" };
}
