import { isCover } from "./covers";
import type { Event } from "./events";
import { field } from "./forms";
import { addDays, isClock, isDate } from "./time";

type Fields = Omit<Event, "id" | "shareId" | "hostId" | "createdAt" | "timezone">;

/** How far ahead an event can be dated. Five years, not two: the spec's
 *  fixtures date their events in early 2030, and a closer limit would have
 *  every one of them refused. Far enough for a wedding, near enough to
 *  catch a typo'd year. */
export const EVENT_YEARS_AHEAD = 5;

/** The last date an event can be on, from today in the host's timezone. */
export const lastEventDate = (today: string) => addDays(today, Math.round(365.25 * EVENT_YEARS_AHEAD));

/** A whole number in [min, max] from a form field's text; null for anything
 *  else ("0" below min, "-3", "2.5", "1e3", "abc"). */
function wholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  return n >= min && n <= max ? n : null;
}

/** An event's details from its form (create or edit), checked, or the
 *  error code to show on the form. `today` is the date where the host is;
 *  an edit passes the date the event already has as `keep`, so a host can
 *  still fix last week's event without moving it. */
export function readEventForm(
  form: FormData,
  when: { today: string; keep?: string },
): { fields: Fields } | { error: string } {
  const title = field(form.get("title"), 80);
  const date = String(form.get("date") ?? "");
  const startTime = String(form.get("start") ?? "");
  const endTime = String(form.get("end") ?? "");
  if (!title || !isDate(date) || !isClock(startTime) || !isClock(endTime)) return { error: "event-missing" };
  // an end before the start runs into the next day; the same minute is no event
  if (endTime === startTime) return { error: "event-time" };
  const inRange = date >= when.today && date <= lastEventDate(when.today);
  if (!inRange && date !== when.keep) return { error: "event-date" };

  // a deadline is a date and a time, or nothing
  const byDate = String(form.get("rsvpByDate") ?? "");
  const byTime = String(form.get("rsvpByTime") ?? "") || (byDate ? "23:59" : "");
  const deadline = isDate(byDate) && isClock(byTime);

  // empty is no limit; anything else has to be a whole number of spots
  const spotsText = String(form.get("capacity") ?? "").trim();
  const capacity = spotsText === "" ? null : wholeNumber(spotsText, 1, 1000);
  if (spotsText !== "" && capacity === null) return { error: "event-capacity" };
  const plusText = String(form.get("maxPlusOnes") ?? "").trim();
  const maxPlusOnes = plusText === "" ? 0 : wholeNumber(plusText, 0, 3);
  if (maxPlusOnes === null) return { error: "event-plus-ones" };

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
      capacity,
      maxPlusOnes,
      rsvpByDate: deadline ? byDate : null,
      rsvpByTime: deadline ? byTime : null,
      cover: isCover(cover) ? cover : "sunset",
    },
  };
}
