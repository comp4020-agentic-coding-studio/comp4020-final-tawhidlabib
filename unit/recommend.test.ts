import { describe, expect, it } from "vitest";
import { recommend, tradeoff } from "../src/lib/recommend";
import { FIRST_HOUR, LAST_HOUR, slotKey } from "../src/lib/time";

// recommend() picks the stretches the best-times cards offer. These call it
// directly with a made-up week, so a change to the ranking shows here in
// milliseconds, with no group to build over HTTP.

const MON = "2030-01-07";
const TUE = "2030-01-08";
const WED = "2030-01-09";

/** The `free` map recommend() reads: who is free for [from, to) on a date. */
function week(...stretches: [person: number, date: string, from: number, to: number][]) {
  const free = new Map<string, Set<number>>();
  for (const [person, date, from, to] of stretches) {
    for (let hour = from; hour < to; hour++) {
      const key = slotKey(date, hour);
      if (!free.has(key)) free.set(key, new Set());
      free.get(key)?.add(person);
    }
  }
  return free;
}

const never = () => false;

describe("recommend()", () => {
  it("offers the longest stretch two people share, not one person's longest", () => {
    // the doc comment's own example: Ana 4pm–10pm, Ben 6pm–11pm
    const free = week([1, MON, 16, 22], [2, MON, 18, 23]);
    expect(recommend(2, free, [MON], never)).toEqual([{ date: MON, start: 18, end: 22, people: [1, 2] }]);
  });

  it("ranks by how many can come, then how long, then how soon", () => {
    const free = week(
      // Mon 9–11: all three, two hours
      [1, MON, 9, 11],
      [2, MON, 9, 11],
      [3, MON, 9, 11],
      // Mon 18–23: Ana and Ben only, five hours
      [1, MON, 18, 23],
      [2, MON, 18, 23],
      // Mon 13–14: Ben and Cat only, one hour
      [2, MON, 13, 14],
      [3, MON, 13, 14],
      // Tue 13–15 and Wed 8–10: all three, two hours each
      [1, TUE, 13, 15],
      [2, TUE, 13, 15],
      [3, TUE, 13, 15],
      [1, WED, 8, 10],
      [2, WED, 8, 10],
      [3, WED, 8, 10],
    );
    const got = recommend(3, free, [MON, TUE, WED], never, 10);
    expect(got.map((r) => [r.date, r.start, r.end, r.people.length])).toEqual([
      // more people beats a longer stretch; at equal people and length the
      // earlier date wins; at equal people, five hours beat one, though
      // the one comes first in the day
      [MON, 9, 11, 3],
      [TUE, 13, 15, 3],
      [WED, 8, 10, 3],
      [MON, 18, 23, 2],
      [MON, 13, 14, 2],
    ]);
  });

  it("breaks a tie on the same day by the earlier start", () => {
    const free = week([1, MON, 9, 11], [2, MON, 9, 11], [1, MON, 19, 21], [2, MON, 19, 21]);
    expect(recommend(2, free, [MON], never).map((r) => r.start)).toEqual([9, 19]);
  });

  it("orders dates by the order they sort in, whatever order they're given", () => {
    const free = week([1, MON, 9, 11], [2, MON, 9, 11], [1, WED, 9, 11], [2, WED, 9, 11]);
    expect(recommend(2, free, [WED, MON], never).map((r) => r.date)).toEqual([MON, WED]);
  });

  it("offers only maximal stretches: never a piece of a longer one", () => {
    const free = week([1, MON, 10, 16], [2, MON, 10, 16]);
    const got = recommend(2, free, [MON], never, 100);
    expect(got).toEqual([{ date: MON, start: 10, end: 16, people: [1, 2] }]);
  });

  it("offers a shorter stretch with more people alongside a longer one with fewer", () => {
    // Ana and Ben 10–16; Cat joins 12–14. Both stretches are maximal for
    // their own set of people, so both are offered: three people first.
    const free = week([1, MON, 10, 16], [2, MON, 10, 16], [3, MON, 12, 14]);
    expect(recommend(3, free, [MON], never, 100)).toEqual([
      { date: MON, start: 12, end: 14, people: [1, 2, 3] },
      { date: MON, start: 10, end: 16, people: [1, 2] },
    ]);
  });

  it("skips hours that have started, and offers what's left of a stretch", () => {
    const free = week([1, MON, 9, 14], [2, MON, 9, 14]);
    const startedBefore11 = (date: string, hour: number) => date === MON && hour < 11;
    expect(recommend(2, free, [MON], startedBefore11)).toEqual([{ date: MON, start: 11, end: 14, people: [1, 2] }]);
  });

  it("offers nothing on a day that has wholly started", () => {
    const free = week([1, MON, 9, 14], [2, MON, 9, 14], [1, TUE, 18, 20], [2, TUE, 18, 20]);
    const mondayGone = (date: string) => date === MON;
    expect(recommend(2, free, [MON, TUE], mondayGone)).toEqual([{ date: TUE, start: 18, end: 20, people: [1, 2] }]);
  });

  it("in a group of one, offers that one person's own stretches", () => {
    const free = week([1, MON, 9, 11], [1, TUE, 18, 22]);
    expect(recommend(1, free, [MON, TUE], never)).toEqual([
      { date: TUE, start: 18, end: 22, people: [1] },
      { date: MON, start: 9, end: 11, people: [1] },
    ]);
  });

  it("in a bigger group, never offers a stretch only one person can make", () => {
    const free = week([1, MON, 9, 12], [2, MON, 14, 18], [3, TUE, 8, 24]);
    expect(recommend(3, free, [MON, TUE], never)).toEqual([]);
  });

  it("offers nothing when nobody has marked an hour", () => {
    expect(recommend(4, new Map(), [MON, TUE, WED], never)).toEqual([]);
  });

  it("offers the whole day, first hour to midnight, when everyone is free all day", () => {
    const free = week([1, MON, 0, 24], [2, MON, 0, 24], [3, MON, 0, 24]);
    expect(recommend(3, free, [MON], never)).toEqual([
      { date: MON, start: FIRST_HOUR, end: LAST_HOUR + 1, people: [1, 2, 3] },
    ]);
  });

  it("returns at most `limit`, three by default", () => {
    const free = week(
      ...[MON, TUE, WED].flatMap((date) => [
        [1, date, 9, 10] as [number, string, number, number],
        [2, date, 9, 10] as [number, string, number, number],
        [1, date, 15, 16] as [number, string, number, number],
        [2, date, 15, 16] as [number, string, number, number],
      ]),
    );
    expect(recommend(2, free, [MON, TUE, WED], never, 100)).toHaveLength(6);
    expect(recommend(2, free, [MON, TUE, WED], never)).toHaveLength(3);
    expect(recommend(2, free, [MON, TUE, WED], never, 1)).toEqual([{ date: MON, start: 9, end: 10, people: [1, 2] }]);
  });

  it("lists who can come in id order", () => {
    const free = week([7, MON, 9, 11], [3, MON, 9, 11], [5, MON, 9, 11]);
    expect(recommend(3, free, [MON], never)[0].people).toEqual([3, 5, 7]);
  });
});

describe("tradeoff()", () => {
  // recommend() ranks by how many can come first, so the top card is the
  // widest; when a longer stretch exists that suits fewer, say the top one is
  // short rather than leave the group to find out.
  it("says the best time suits the most people but only for a short while", () => {
    const free = week(
      [1, TUE, 18, 19],
      [2, TUE, 18, 19],
      [3, TUE, 18, 19],
      [1, WED, 12, 17],
      [2, WED, 12, 17],
    );
    const recs = recommend(3, free, [TUE, WED], never);
    expect(tradeoff(recs, 3)).toBe("Tue 8 Jan, 6pm–7pm suits all 3, but only for 1 hour.");
  });

  it("counts 'n of m' when the top leaves someone out, and pluralises hours", () => {
    const recs = [
      { date: TUE, start: 18, end: 20, people: [1, 2] },
      { date: WED, start: 12, end: 17, people: [1] },
    ];
    expect(tradeoff(recs, 3)).toBe("Tue 8 Jan, 6pm–8pm suits 2 of 3, but only for 2 hours.");
  });

  it("is silent when the top is also the longest, or when there is nothing to compare", () => {
    const free = week([1, TUE, 12, 17], [2, TUE, 12, 17], [1, WED, 18, 19], [2, WED, 18, 19]);
    expect(tradeoff(recommend(2, free, [TUE, WED], never), 2)).toBeNull();
    expect(tradeoff([], 3)).toBeNull();
    expect(tradeoff([{ date: TUE, start: 18, end: 19, people: [1, 2] }], 2)).toBeNull();
  });
});
