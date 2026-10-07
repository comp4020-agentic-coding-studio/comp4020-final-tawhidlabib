import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

// Uploaded images, as files beside the database: on the volume in
// production (/data/uploads), in .data/uploads locally. A file is accepted
// only if its first bytes say it's a JPEG, PNG or WebP --- not because of
// its name or the type the browser claims --- and only up to 5 MB. Names
// are random, so they can't be guessed, and only names of that shape are
// ever read back, so a path can't be smuggled in.

export const MAX_BYTES = 5 * 1024 * 1024;
const dir = join(dirname(process.env.DATABASE_PATH ?? "./.data/app.db"), "uploads");
mkdirSync(dir, { recursive: true });

const KINDS = [
  { mime: "image/jpeg", ext: "jpg", test: (b: Uint8Array) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: "image/png",
    ext: "png",
    test: (b: Uint8Array) => [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((v, i) => b[i] === v),
  },
  {
    mime: "image/webp",
    ext: "webp",
    test: (b: Uint8Array) =>
      String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP",
  },
] as const;

const NAME = /^[A-Za-z0-9_-]{20,}\.(jpg|png|webp)$/;

export type Saved = { file: string; mime: string } | { error: "too-big" | "not-an-image" };

export async function saveImage(upload: File): Promise<Saved> {
  if (upload.size > MAX_BYTES) return { error: "too-big" };
  const bytes = new Uint8Array(await upload.arrayBuffer());
  if (bytes.length > MAX_BYTES) return { error: "too-big" };
  const kind = KINDS.find((k) => k.test(bytes));
  if (!kind) return { error: "not-an-image" };
  const file = `${randomBytes(15).toString("base64url")}.${kind.ext}`;
  await writeFile(join(dir, file), bytes);
  return { file, mime: kind.mime };
}

export async function readImage(file: string): Promise<Uint8Array<ArrayBuffer> | undefined> {
  if (!NAME.test(file)) return undefined;
  try {
    return new Uint8Array(await readFile(join(dir, file)));
  } catch {
    return undefined;
  }
}

export async function deleteImage(file: string): Promise<void> {
  if (!NAME.test(file)) return;
  await unlink(join(dir, file)).catch(() => {});
}

export const mimeOf = (file: string) => KINDS.find((k) => file.endsWith(`.${k.ext}`))?.mime ?? "application/octet-stream";
