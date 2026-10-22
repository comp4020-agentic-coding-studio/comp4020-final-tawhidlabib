import { describe, expect, it } from "vitest";
import {
  addDays,
  clockToUtc,
  FIRST_HOUR,
  hasStarted,
  LAST_HOUR,
  todayIn,
  wallTimeToUtc,
  weekDates,
  weekStartOf,
} from "../src/lib/time";

// Dates and hours are wall-clock time in the group's zone, and
// wallTimeToUtc is the one place that becomes an instant (time.ts). These
// pin it across both of Sydney's daylight-saving changes and London's,
// where an hour is skipped or happens twice.
//
// The unit project runs with TZ=UTC (vitest.config.ts), as Fly does, and
// none of this may depend on the machine's own zone: the last test re-runs
// the date helpers with the machine set to zones either side of UTC.

const SYD = "Australia/Sydney";
const LON = "Europe/London";
const iso = (d: Date) => d.toISOString();
const HOUR = 3_600_000;

/** Each bookable hour's instant on a date: FIRST_HOUR to midnight. */
const bookable = (date: string, tz: string) =>
  Array.from({ length: LAST_HOUR + 2 - FIRST_HOUR }, (_, i) => wallTimeToUtc(date, FIRST_HOUR + i, tz).getTime());

/** What a wall clock in a zone reads at an instant: "2026-10-04 03:00". */
const reads = (instant: Date, tz: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: tz, dateStyle: "short", timeStyle: "short" }).format(instant);

describe("wallTimeToUtc across Sydney's daylight-saving changes", () => {
  it("reads AEST (UTC+10) before clocks go forward on 4 Oct 2026, AEDT (UTC+11) after", () => {
    expect(iso(wallTimeToUtc("2026-10-03", 19, SYD))).toBe("2026-10-03T09:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-10-04", 1, SYD))).toBe("2026-10-03T15:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-10-04", 3, SYD))).toBe("2026-10-03T16:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-10-04", 19, SYD))).toBe("2026-10-04T08:00:00.000Z");
  });

  it("reads AEDT before clocks go back on 4 Apr 2027, AEST after", () => {
    expect(iso(wallTimeToUtc("2027-04-03", 19, SYD))).toBe("2027-04-03T08:00:00.000Z");
    expect(iso(wallTimeToUtc("2027-04-04", 1, SYD))).toBe("2027-04-03T14:00:00.000Z");
    expect(iso(wallTimeToUtc("2027-04-04", 3, SYD))).toBe("2027-04-03T17:00:00.000Z");
    expect(iso(wallTimeToUtc("2027-04-04", 19, SYD))).toBe("2027-04-04T09:00:00.000Z");
  });

  it("puts 2:00 on the day clocks go forward, an hour that never happens, at 3:00 AEDT", () => {
    // 2:00–2:59 is skipped; the code lands on the instant the clock jumps to
    const skipped = wallTimeToUtc("2026-10-04", 2, SYD);
    expect(iso(skipped)).toBe("2026-10-03T16:00:00.000Z");
    expect(reads(skipped, SYD)).toBe("2026-10-04 03:00");
  });

  it("picks the second 2:00, AEST, on the day clocks go back", () => {
    // 2:00–2:59 happens twice (AEDT, then AEST); the code takes the later one
    const repeated = wallTimeToUtc("2027-04-04", 2, SYD);
    expect(iso(repeated)).toBe("2027-04-03T16:00:00.000Z");
    expect(reads(repeated, SYD)).toBe("2027-04-04 02:00");
    expect(iso(clockToUtc("2027-04-04", "02:30", SYD))).toBe("2027-04-03T16:30:00.000Z");
  });

  it("keeps every bookable hour one hour apart on both change days", () => {
    // the change happens before the grid's first hour, so 8:00 to midnight
    // is sixteen ordinary hours either way
    for (const date of ["2026-10-04", "2027-04-04"]) {
      const hours = bookable(date, SYD);
      expect(hours.slice(1).map((t, i) => (t - hours[i]) / HOUR)).toEqual(Array(LAST_HOUR + 1 - FIRST_HOUR).fill(1));
    }
  });

  it("reads hour 24 as midnight at the start of the next day", () => {
    expect(iso(wallTimeToUtc("2026-10-04", 24, SYD))).toBe(iso(wallTimeToUtc("2026-10-05", 0, SYD)));
    expect(iso(wallTimeToUtc("2027-04-04", 24, SYD))).toBe(iso(wallTimeToUtc("2027-04-05", 0, SYD)));
  });

  it("gives a 23-hour day when clocks go forward and a 25-hour day when they go back", () => {
    const day = (date: string) => (wallTimeToUtc(addDays(date, 1), 0, SYD).getTime() - wallTimeToUtc(date, 0, SYD).getTime()) / HOUR;
    expect(day("2026-10-04")).toBe(23);
    expect(day("2027-04-04")).toBe(25);
    expect(day("2026-10-05")).toBe(24);
  });
});

describe("wallTimeToUtc across London's (northern) changes", () => {
  it("reads GMT before clocks go forward on 29 Mar 2026, BST (UTC+1) after", () => {
    expect(iso(wallTimeToUtc("2026-03-28", 19, LON))).toBe("2026-03-28T19:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-03-29", 0, LON))).toBe("2026-03-29T00:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-03-29", 2, LON))).toBe("2026-03-29T01:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-03-29", 19, LON))).toBe("2026-03-29T18:00:00.000Z");
  });

  it("reads BST before clocks go back on 25 Oct 2026, GMT after", () => {
    expect(iso(wallTimeToUtc("2026-10-24", 19, LON))).toBe("2026-10-24T18:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-10-25", 0, LON))).toBe("2026-10-24T23:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-10-25", 2, LON))).toBe("2026-10-25T02:00:00.000Z");
    expect(iso(wallTimeToUtc("2026-10-25", 19, LON))).toBe("2026-10-25T19:00:00.000Z");
  });

  it("puts 1:00 on the day clocks go forward, an hour that never happens, at 2:00 BST", () => {
    const skipped = wallTimeToUtc("2026-03-29", 1, LON);
    expect(iso(skipped)).toBe("2026-03-29T01:00:00.000Z");
    expect(reads(skipped, LON)).toBe("2026-03-29 02:00");
  });

  it("picks the second 1:00, GMT, on the day clocks go back", () => {
    const repeated = wallTimeToUtc("2026-10-25", 1, LON);
    expect(iso(repeated)).toBe("2026-10-25T01:00:00.000Z");
    expect(reads(repeated, LON)).toBe("2026-10-25 01:00");
  });

  it("keeps every bookable hour one hour apart on both change days", () => {
    for (const date of ["2026-03-29", "2026-10-25"]) {
      const hours = bookable(date, LON);
      expect(hours.slice(1).map((t, i) => (t - hours[i]) / HOUR)).toEqual(Array(LAST_HOUR + 1 - FIRST_HOUR).fill(1));
    }
  });
});

describe("hasStarted", () => {
  it("is false until the hour's first instant, and true from it", () => {
    const at = wallTimeToUtc("2026-10-04", 8, SYD);
    expect(hasStarted("2026-10-04", 8, SYD, new Date(at.getTime() - 1))).toBe(false);
    expect(hasStarted("2026-10-04", 8, SYD, at)).toBe(true);
  });

  it("reads the hour in the group's zone, not the machine's", () => {
    // 21:30 UTC on 3 Oct is 8:30am on 4 Oct in Sydney (AEDT) and 10:30pm
    // on 3 Oct in London
    const now = new Date("2026-10-03T21:30:00Z");
    expect(hasStarted("2026-10-04", 8, SYD, now)).toBe(true);
    expect(hasStarted("2026-10-04", 9, SYD, now)).toBe(false);
    expect(hasStarted("2026-10-03", 22, LON, now)).toBe(true);
    expect(hasStarted("2026-10-03", 23, LON, now)).toBe(false);
  });

  it("counts the new offset straight after Sydney's clocks go back", () => {
    // 8:00 AEST on 4 Apr 2027 is 22:00 UTC on the 3rd; under the old AEDT
    // offset it would have been 21:00, an hour early
    expect(hasStarted("2027-04-04", 8, SYD, new Date("2027-04-03T21:30:00Z"))).toBe(false);
    expect(hasStarted("2027-04-04", 8, SYD, new Date("2027-04-03T22:00:00Z"))).toBe(true);
  });
});

describe("todayIn", () => {
  it("turns over at local midnight, on either side of a change", () => {
    expect(todayIn(SYD, new Date("2026-10-03T13:59:59Z"))).toBe("2026-10-03");
    expect(todayIn(SYD, new Date("2026-10-03T14:00:00Z"))).toBe("2026-10-04");
    // midnight that night is AEDT: an hour earlier in UTC
    expect(todayIn(SYD, new Date("2026-10-04T12:59:59Z"))).toBe("2026-10-04");
    expect(todayIn(SYD, new Date("2026-10-04T13:00:00Z"))).toBe("2026-10-05");
  });
});

describe("dates: addDays, weekStartOf, weekDates", () => {
  it("adds whole calendar days, never 24-hour blocks, across a change", () => {
    expect(addDays("2026-10-03", 1)).toBe("2026-10-04");
    expect(addDays("2026-10-04", 1)).toBe("2026-10-05");
    expect(addDays("2027-04-03", 2)).toBe("2027-04-05");
    expect(addDays("2026-10-25", -1)).toBe("2026-10-24");
    expect(addDays("2026-03-29", 7)).toBe("2026-04-05");
  });

  it("crosses month and year ends, and a leap day", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("finds the Monday of a week, a change-over Sunday included", () => {
    // both Sydney changes fall on a Sunday: the last day of their week
    expect(weekStartOf("2026-10-04")).toBe("2026-09-28");
    expect(weekStartOf("2026-10-05")).toBe("2026-10-05");
    expect(weekStartOf("2027-04-04")).toBe("2027-03-29");
    expect(weekStartOf("2026-03-29")).toBe("2026-03-23");
    expect(weekStartOf("2026-10-25")).toBe("2026-10-19");
    expect(weekStartOf("2026-09-28")).toBe("2026-09-28");
  });

  it("lists a week's seven days, Monday first, through a change", () => {
    expect(weekDates("2026-09-28")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
    expect(weekDates("2027-03-29")).toHaveLength(7);
    expect(weekDates("2027-03-29").at(-1)).toBe("2027-04-04");
    expect(weekDates("2026-12-28").at(-1)).toBe("2027-01-03");
  });
});

describe("the machine's own zone", () => {
  it("changes nothing: the same answers with the machine east or west of UTC", () => {
    // Node re-reads TZ when it's assigned, so this moves the "machine"
    // without a new process. A helper that parsed a date as local time
    // would shift a day here east of UTC (Sydney, a dev laptop) and pass
    // in UTC (Fly).
    const answers = () => [
      addDays("2026-10-03", 1),
      addDays("2027-04-03", 2),
      weekStartOf("2026-10-04"),
      weekDates("2026-09-28").join(),
      iso(wallTimeToUtc("2026-10-04", 2, SYD)),
      iso(wallTimeToUtc("2027-04-04", 2, SYD)),
      iso(wallTimeToUtc("2026-10-25", 1, LON)),
      todayIn(SYD, new Date("2026-10-03T14:00:00Z")),
    ];
    const before = process.env.TZ;
    try {
      process.env.TZ = "UTC";
      const utc = answers();
      for (const zone of ["Australia/Sydney", "America/Los_Angeles", "Pacific/Kiritimati", "Pacific/Pago_Pago"]) {
        process.env.TZ = zone;
        expect(answers(), `with the machine in ${zone}`).toEqual(utc);
      }
    } finally {
      process.env.TZ = before;
    }
  });
});
