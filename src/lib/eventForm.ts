import { isCover } from "./covers";
import type { Event } from "./events";
import { field } from "./forms";
import { isClock, isDate } from "./time";

type Fields = Omit<Event, "id" | "shareId" | "hostId" | "createdAt" | "timezone">;

/** An event's details from its form (create or edit), checked, or the
 *  error code to show on the form. */
export function readEventForm(form: FormData): { fields: Fields } | { error: string } {
  const title = field(form.get("title"), 80);
  const date = String(form.get("date") ?? "");
  const startTime = String(form.get("start") ?? "");
  const endTime = String(form.get("end") ?? "");
  if (!title || !isDate(date) || !isClock(startTime) || !isClock(endTime)) return { error: "event-missing" };
  if (endTime <= startTime) return { error: "event-time" };

  // a deadline is a date and a time, or nothing
  const byDate = String(form.get("rsvpByDate") ?? "");
  const byTime = String(form.get("rsvpByTime") ?? "") || (byDate ? "23:59" : "");
  const deadline = isDate(byDate) && isClock(byTime);

  const spots = Number(form.get("capacity"));
  const cover = form.get("cover");
  return {
    fields: {
      title,
      date,
      startTime,
      endTime,
      location: field(form.get("location"), 120),
      details: String(form.get("details") ?? "").trim().slice(0, 1000),
      visibility: form.get("visibility") === "private" ? "private" : "public",
      capacity: Number.isInteger(spots) && spots > 0 ? Math.min(spots, 1000) : null,
      maxPlusOnes: Math.max(0, Math.min(3, Number(form.get("maxPlusOnes")) || 0)),
      rsvpByDate: deadline ? byDate : null,
      rsvpByTime: deadline ? byTime : null,
      cover: isCover(cover) ? cover : "sunset",
    },
  };
}
