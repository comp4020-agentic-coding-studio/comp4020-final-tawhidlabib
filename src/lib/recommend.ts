import { FIRST_HOUR, LAST_HOUR, slotKey } from "./time";

export type Recommendation = {
  date: string;
  start: number;
  /** Exclusive. */
  end: number;
  /** Member ids free for the whole stretch. */
  people: number[];
};

/**
 * The stretches worth proposing: for each day, every run of hours where the
 * same people are free throughout, kept only when it's *maximal* --- it can't
 * grow an hour either way without losing someone. Ranked by how many people
 * can come, then by how long it lasts, then by how soon.
 *
 * Maximal is what makes "longest overlap" honest. If Ana is free 4pm–10pm and
 * Ben 6pm–11pm, the answer is the 6–10 the two of them share, not Ana's six
 * hours alone; a stretch of one is only offered in a group of one.
 *
 * `free` holds the member ids free in each slot, keyed by slotKey. Hours that
 * have already started (`started`) are never recommended.
 */
export function recommend(
  memberCount: number,
  free: Map<string, Set<number>>,
  dates: string[],
  started: (date: string, hour: number) => boolean,
  limit = 3,
): Recommendation[] {
  const minPeople = memberCount >= 2 ? 2 : 1;
  const freeAt = (date: string, hour: number) =>
    started(date, hour) ? new Set<number>() : (free.get(slotKey(date, hour)) ?? new Set<number>());
  const allFree = (people: Set<number>, date: string, hour: number) => {
    if (hour < FIRST_HOUR || hour > LAST_HOUR) return false;
    const there = freeAt(date, hour);
    return [...people].every((p) => there.has(p));
  };

  const found: Recommendation[] = [];
  for (const date of dates) {
    for (let start = FIRST_HOUR; start <= LAST_HOUR; start++) {
      let people = freeAt(date, start);
      for (let end = start + 1; end <= LAST_HOUR + 1; end++) {
        if (end > start + 1) {
          const next = freeAt(date, end - 1);
          people = new Set([...people].filter((p) => next.has(p)));
        }
        if (people.size < minPeople) break;
        const growsRight = allFree(people, date, end);
        const growsLeft = allFree(people, date, start - 1);
        if (!growsRight && !growsLeft) {
          found.push({ date, start, end, people: [...people].sort((a, b) => a - b) });
        }
      }
    }
  }

  return found
    .sort(
      (a, b) =>
        b.people.length - a.people.length ||
        b.end - b.start - (a.end - a.start) ||
        a.date.localeCompare(b.date) ||
        a.start - b.start,
    )
    .slice(0, limit);
}
