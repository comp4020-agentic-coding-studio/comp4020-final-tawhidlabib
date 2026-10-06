import type { APIRoute } from "astro";
import { hangoutEvent, ics } from "../../../lib/calendar";
import { getGroup, getHangout } from "../../../lib/db";
import { currentMember } from "../../../lib/identity";

/** The hangout as a calendar file, for the group's members only. */
export const GET: APIRoute = ({ params, cookies, url }) => {
  const hangout = getHangout(Number(params.id));
  const group = hangout && getGroup(hangout.groupId);
  if (!hangout || !group) return new Response("No such hangout", { status: 404 });
  if (!currentMember(cookies, group.id)) {
    return new Response("This hangout is for its group only", { status: 403 });
  }

  return new Response(ics(hangoutEvent(hangout, group, url.origin)), {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="hangout-${hangout.id}.ics"`,
    },
  });
};
