import { describe, expect, it } from "vitest";
import { hangoutEvent } from "../src/lib/calendar";
import type { Group, Hangout } from "../src/lib/schema";

// A calendar entry has to say what it is at a glance: in a week of
// entries, "Hangout" five times tells nobody which plan is which.

const group = { id: "g1", name: "Uni mates", timezone: "Australia/Sydney" } as Group;
const plan = (title: string) =>
  ({ id: 7, groupId: "g1", date: "2030-01-08", startHour: 18, endHour: 20, title }) as Hangout;

describe("a hangout's calendar entry", () => {
  it("names the group as well as the plan", () => {
    expect(hangoutEvent(plan("Dumplings"), group, "https://x.test").title).toBe("Dumplings · Uni mates");
  });

  it("a plan left with the default title is still told apart by its group", () => {
    expect(hangoutEvent(plan("Hangout"), group, "https://x.test").title).toBe("Hangout · Uni mates");
  });
});
