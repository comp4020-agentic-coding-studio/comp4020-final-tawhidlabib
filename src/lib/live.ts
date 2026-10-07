// Live updates (crit 9): who's listening to what, and telling them when it
// changes. Topics name what a page shows --- `group:<id>`, `event:<shareId>`,
// `thread:<kind>:<ref>`, `person:<id>` --- and a change carries only the
// topic and what kind of change; each open page then re-reads what it shows
// through the same access rules as any request. So nothing private travels
// down the stream itself.
//
// In memory, in this process: right for one machine (fly.toml, --ha=false).
// A second machine would need a shared channel (ADR 6 says so).

export type Message = { event: "change" | "presence"; data: Record<string, unknown> };
type Listener = (message: Message) => void;
/** Who a connection is, for "here now"; null for someone without a name. */
export type Who = { id: string; name: string } | null;

const listeners = new Map<string, Set<Listener>>();
const here = new Map<string, Map<Listener, Who>>();

const PRESENCE = /^(group|event):/;

export function publish(topic: string, what = "change"): void {
  for (const listener of listeners.get(topic) ?? []) {
    listener({ event: "change", data: { topic, what } });
  }
}

function announce(topic: string): void {
  const people = new Map<string, string>();
  let others = 0;
  for (const who of here.get(topic)?.values() ?? []) {
    if (who) people.set(who.id, who.name);
    else others++;
  }
  const data = { topic, people: [...people].map(([id, name]) => ({ id, name })), others };
  for (const listener of listeners.get(topic) ?? []) listener({ event: "presence", data });
}

/** Listen to topics until the returned function is called. `who` puts the
 *  connection in "here now" for the group and event topics. */
export function subscribe(topics: string[], listener: Listener, who: (topic: string) => Who): () => void {
  for (const topic of topics) {
    if (!listeners.has(topic)) listeners.set(topic, new Set());
    listeners.get(topic)?.add(listener);
    if (PRESENCE.test(topic)) {
      if (!here.has(topic)) here.set(topic, new Map());
      here.get(topic)?.set(listener, who(topic));
      announce(topic);
    }
  }
  return () => {
    for (const topic of topics) {
      listeners.get(topic)?.delete(listener);
      if (listeners.get(topic)?.size === 0) listeners.delete(topic);
      if (here.get(topic)?.delete(listener)) {
        if (here.get(topic)?.size === 0) here.delete(topic);
        else announce(topic);
      }
    }
  };
}
