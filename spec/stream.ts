import type { Person } from "./people";

// A listener on the live stream (server-sent events), as an open browser tab
// would hold one: it collects every event and lets a test wait for the one
// it expects, with a deadline.

export type LiveEvent = { event: string; data: Record<string, unknown> };

export async function listen(person: Person, topics: string[]) {
  const abort = new AbortController();
  const res = await fetch(new URL(`/api/live?topics=${encodeURIComponent(topics.join(","))}`, person.baseUrl), {
    headers: person.cookie ? { cookie: person.cookie } : {},
    signal: abort.signal,
  });
  const seen: LiveEvent[] = [];
  const waiting: { test: (e: LiveEvent) => boolean; done: (e: LiveEvent) => void }[] = [];

  if (res.ok && res.body) {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let end: number;
          while ((end = buffer.indexOf("\n\n")) >= 0) {
            const block = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const event = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (!event) continue; // a heartbeat comment
            const e = { event, data: data ? JSON.parse(data) : {} };
            seen.push(e);
            for (const w of [...waiting]) {
              if (w.test(e)) {
                waiting.splice(waiting.indexOf(w), 1);
                w.done(e);
              }
            }
          }
        }
      } catch {
        // aborted
      }
    })();
  }

  /** The first event (already seen, or still to come) that passes `test`,
   *  or a rejection after `ms`. */
  function next(test: (e: LiveEvent) => boolean, ms = 1000): Promise<LiveEvent> {
    const already = seen.find(test);
    if (already) return Promise.resolve(already);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`nothing within ${ms} ms; saw ${JSON.stringify(seen)}`)), ms);
      waiting.push({ test, done: (e) => (clearTimeout(timer), resolve(e)) });
    });
  }

  return {
    status: res.status,
    seen,
    next,
    /** Start fresh: only events from here on count. */
    clear: () => seen.splice(0, seen.length),
    close: () => abort.abort(),
  };
}
