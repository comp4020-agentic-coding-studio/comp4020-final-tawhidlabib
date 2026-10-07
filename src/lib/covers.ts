// The covers an event can wear: each a gradient, independent of the
// viewer's colour theme, so an event looks the same to everyone.
export const COVERS = [
  { id: "sunset", label: "Sunset" },
  { id: "ocean", label: "Ocean" },
  { id: "forest", label: "Forest" },
  { id: "grape", label: "Grape" },
  { id: "rose", label: "Rose" },
  { id: "night", label: "Night" },
] as const;

export type Cover = (typeof COVERS)[number]["id"];
export const isCover = (value: unknown): value is Cover => COVERS.some((c) => c.id === value);
