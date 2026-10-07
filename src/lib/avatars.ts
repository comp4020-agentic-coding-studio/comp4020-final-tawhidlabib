import { eq } from "drizzle-orm";
import { db } from "./db";
import { people } from "./schema";

// What people can pick as an avatar when they don't upload a photo.
export const EMOJI = [
  "😀", "😎", "🥳", "🤠", "🦊", "🐼", "🐙", "🦄",
  "🐸", "🐝", "🌻", "🌈", "🔥", "⭐", "🍕", "🌮",
  "☕", "🎸", "🎮", "⚽", "🏀", "🚲", "🏔️", "🎨",
] as const;
export const isAvatarEmoji = (value: unknown) => EMOJI.some((e) => e === value);

export function setAvatar(personId: number, fields: { avatarPhoto?: string | null; avatarEmoji?: string | null }) {
  db.update(people).set(fields).where(eq(people.id, personId)).run();
}

/** Whether a file is someone's avatar photo (and so public to show). */
export const isAvatarFile = (file: string) =>
  !!db.select({ id: people.id }).from(people).where(eq(people.avatarPhoto, file)).get();
