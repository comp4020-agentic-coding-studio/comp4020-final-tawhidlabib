import type { APIRoute, AstroCookies } from "astro";
import { getGroup } from "../../lib/db";
import { canSee, eventByShareId } from "../../lib/events";
import { currentMember, currentPerson } from "../../lib/identity";
import { subscribe, type Who } from "../../lib/live";
import type { Person } from "../../lib/people";
import { openThread } from "../../lib/talk";

// The live stream (crit 9): server-sent events for the topics a page shows.
// Each topic is checked the way its page is, and one refused topic refuses
// the whole stream. Events carry only which topic changed; the page then
// re-reads it through the same rules.

const HEARTBEAT_MS = 20_000; // under Fly's proxy idle timeout

/** The topic as the server names it, or null if this visitor can't have it. */
function authorise(topic: string, cookies: AstroCookies, person: Person | undefined): string | null {
  const [kind, ...rest] = topic.split(":");
  const ref = rest.join(":");
  if (kind === "person" && ref === "me") return person ? `person:${person.id}` : null;
  if (kind === "group") return getGroup(ref) && currentMember(cookies, ref) ? topic : null;
  if (kind === "event") {
    const event = eventByShareId(ref);
    return event && canSee(event, person) ? topic : null;
  }
  if (kind === "thread") {
    const [threadKind, ...threadRef] = rest;
    return openThread(threadKind ?? "", threadRef.join(":"), cookies)?.visible ? topic : null;
  }
  return null;
}

export const GET: APIRoute = ({ request, url, cookies }) => {
  const person = currentPerson(cookies);
  const asked = [...new Set((url.searchParams.get("topics") ?? "").split(",").map((t) => t.trim()))]
    .filter(Boolean)
    .slice(0, 40);
  if (asked.length === 0) return new Response("Name some topics", { status: 400 });

  const topics: string[] = [];
  for (const t of asked) {
    const topic = authorise(t, cookies, person);
    if (!topic) return new Response(`You can't listen to ${t}`, { status: 403 });
    topics.push(topic);
  }

  // who you are in "here now": your profile, or your name in that group
  const who = (topic: string): Who => {
    if (person) return { id: `p${person.id}`, name: person.name };
    if (topic.startsWith("group:")) {
      const member = currentMember(cookies, topic.slice("group:".length));
      if (member) return { id: `m${member.id}`, name: member.name };
    }
    return null;
  };

  const encoder = new TextEncoder();
  let stop = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          stop();
        }
      };
      write(`retry: 3000\nevent: hello\ndata: ${JSON.stringify({ topics })}\n\n`);
      const unsubscribe = subscribe(
        topics,
        (message) => write(`event: ${message.event}\ndata: ${JSON.stringify(message.data)}\n\n`),
        who,
      );
      const beat = setInterval(() => write(": beat\n\n"), HEARTBEAT_MS);
      let stopped = false;
      stop = () => {
        if (stopped) return;
        stopped = true;
        clearInterval(beat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      request.signal.addEventListener("abort", () => stop());
    },
    cancel() {
      stop();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
};
