// Live updates in the browser (crit 9). Every element marked
// data-live="<topic>" is part of the page that changes when that topic does;
// this opens one event stream for all of them and, on a change, re-reads the
// page and swaps those elements in place. The server decides what you may
// see each time --- the stream only says "this changed".
//
//   - an element you're typing in is left until you're done (blur/submit)
//   - a thread (data-thread) refreshes from /partials/thread
//   - the availability grid (data-live-grid) is patched, never replaced, so
//     your own unsaved taps survive while friends' hours fill in
//   - data-presence="<topic>" shows who else is here now
//   - after a dropped connection, everything refreshes once it's back

import { hue, initials } from "../lib/avatar";

const me = document.body.dataset.person;
const parser = new DOMParser();

function topicsOnPage(): string[] {
  const topics = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-live], [data-presence]")) {
    for (const t of (el.dataset.live ?? el.dataset.presence ?? "").split(" ")) if (t) topics.add(t);
  }
  if (me !== undefined) topics.add("person:me");
  return [...topics];
}

// The server names your personal topic by id; the page calls it person:me.
const pageTopic = (topic: string) => (topic.startsWith("person:") ? "person:me" : topic);

const busy = (el: Element) => {
  const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
  return !!active && el.contains(active) && (active.tagName === "TEXTAREA" || (active.tagName === "INPUT" && active.type === "text"));
};

function deferUntilFree(el: HTMLElement, topic: string) {
  if (el.dataset.stale) return;
  el.dataset.stale = "1";
  el.addEventListener(
    "focusout",
    () =>
      setTimeout(() => {
        if (busy(el)) return;
        delete el.dataset.stale;
        refresh(topic);
      }, 50),
    { once: true },
  );
}

async function refreshThread(el: HTMLElement) {
  const [kind, ...rest] = (el.dataset.thread ?? "").split(":");
  const res = await fetch(`/partials/thread?kind=${kind}&ref=${encodeURIComponent(rest.join(":"))}`);
  if (!res.ok) return;
  const fresh = parser.parseFromString(await res.text(), "text/html").querySelector("[data-thread]");
  if (fresh) el.replaceWith(document.importNode(fresh, true));
}

/** Copy friends' hours into the grid without touching your checkboxes. */
function patchGrid(el: HTMLElement, fresh: Element) {
  for (const cell of fresh.querySelectorAll<HTMLElement>(".slot")) {
    const value = cell.querySelector("input")?.value;
    const mine = value && el.querySelector<HTMLInputElement>(`input[value="${value}"]`)?.closest<HTMLElement>(".slot");
    if (!mine) continue;
    if (mine.dataset.heat !== cell.dataset.heat) {
      mine.dataset.heat = cell.dataset.heat;
      mine.classList.remove("arrived");
      void mine.offsetWidth; // restart the arrival flash
      mine.classList.add("arrived");
    }
    const [label, count] = [".vh", "[aria-hidden]"].map((s) => cell.querySelector(s)?.textContent ?? "");
    const mineLabel = mine.querySelector(".vh");
    const mineCount = mine.querySelector("[aria-hidden]");
    if (mineLabel) mineLabel.textContent = label;
    if (mineCount) mineCount.textContent = count;
  }
}

let page: Promise<Document> | null = null;
/** The page as the server renders it now; one fetch shared by a burst. */
function freshPage(): Promise<Document> {
  page ??= fetch(location.href, { headers: { "x-live": "1" } })
    .then((r) => r.text())
    .then((html) => parser.parseFromString(html, "text/html"))
    .finally(() => setTimeout(() => (page = null), 0));
  return page;
}

async function refresh(topic: string) {
  const els = [...document.querySelectorAll<HTMLElement>("[data-live]")].filter((el) =>
    (el.dataset.live ?? "").split(" ").includes(topic),
  );
  for (const el of els) {
    if (busy(el)) {
      deferUntilFree(el, topic);
      continue;
    }
    if (el.dataset.thread) {
      await refreshThread(el);
      continue;
    }
    if (!el.id) continue;
    const fresh = (await freshPage()).getElementById(el.id);
    if (!fresh) continue;
    if (el.hasAttribute("data-live-grid")) patchGrid(el, fresh);
    else {
      const node = document.importNode(fresh, true) as HTMLElement;
      el.replaceWith(node);
      document.dispatchEvent(new CustomEvent("live:swapped", { detail: node }));
    }
  }
}

const timers = new Map<string, number>();
function schedule(topic: string) {
  clearTimeout(timers.get(topic));
  timers.set(topic, window.setTimeout(() => refresh(topic), 120));
}

function renderPresence(topic: string, people: { id: string; name: string }[], others: number) {
  for (const el of document.querySelectorAll<HTMLElement>(`[data-presence="${topic}"]`)) {
    const rest = people.filter((p) => p.name !== me);
    el.replaceChildren();
    el.hidden = rest.length === 0 && others === 0;
    const stack = document.createElement("span");
    stack.className = "here-avatars";
    for (const p of rest.slice(0, 5)) {
      const a = document.createElement("span");
      a.className = "avatar";
      a.style.setProperty("--hue", String(hue(p.name)));
      a.textContent = initials(p.name);
      a.title = p.name;
      a.setAttribute("aria-hidden", "true");
      stack.append(a);
    }
    const label = document.createElement("span");
    const named = rest.map((p) => p.name);
    const extra = others > 0 ? `${others} other${others === 1 ? "" : "s"}` : "";
    label.textContent = `${[...named.slice(0, 3), ...(named.length > 3 ? [`${named.length - 3} more`] : []), extra]
      .filter(Boolean)
      .join(", ")} ${rest.length + others === 1 ? "is" : "are"} here now`;
    const dot = document.createElement("span");
    dot.className = "live-dot";
    dot.setAttribute("aria-hidden", "true");
    el.append(dot, stack, label);
  }
}

function connect() {
  const topics = topicsOnPage();
  if (topics.length === 0 || !("EventSource" in window)) return;
  const source = new EventSource(`/api/live?topics=${encodeURIComponent(topics.join(","))}`);
  let connectedBefore = false;
  source.addEventListener("hello", () => {
    document.documentElement.dataset.live = "on";
    // back after a drop: catch up on anything missed
    if (connectedBefore) for (const t of topics) schedule(t);
    connectedBefore = true;
  });
  source.addEventListener("change", (e) => {
    const { topic } = JSON.parse((e as MessageEvent).data);
    schedule(pageTopic(topic));
  });
  source.addEventListener("presence", (e) => {
    const { topic, people, others } = JSON.parse((e as MessageEvent).data);
    renderPresence(topic, people, others);
  });
  source.addEventListener("error", () => {
    document.documentElement.dataset.live = "reconnecting";
  });
}

connect();
