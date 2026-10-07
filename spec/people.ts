import { JSDOM } from "jsdom";

// A person driving the app over HTTP: their own cookie jar, so each test can
// play several people at once (and a stranger with an empty jar), the way
// separate browsers would. Shared by the spec files for profiles, friends,
// events and the calendar.

export class Person {
  readonly jar = new Map<string, string>();

  constructor(
    readonly baseUrl: string,
    readonly name = "",
  ) {}

  /** Every cookie this person holds, as a Cookie header's value. */
  get cookie(): string {
    return [...this.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private header(): Record<string, string> {
    return this.cookie ? { cookie: this.cookie } : {};
  }

  private keep(res: Response): void {
    for (const raw of res.headers.getSetCookie()) {
      const [pair, ...attrs] = raw.split(";");
      const [key, ...rest] = pair.split("=");
      const gone = attrs.some((a) => /max-age=0|expires=thu, 01 jan 1970/i.test(a.trim()));
      if (gone) this.jar.delete(key.trim());
      else this.jar.set(key.trim(), rest.join("="));
    }
  }

  /** A form POST, as a browser sends it (Astro checks the Origin header). */
  async post(path: string, fields: Record<string, string | string[]> = {}): Promise<Response> {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(fields)) {
      for (const v of [value].flat()) body.append(key, v);
    }
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: { origin: this.baseUrl, ...this.header() },
      body,
      redirect: "manual",
    });
    this.keep(res);
    return res;
  }

  /** A form POST with files, as a browser sends an upload. */
  async upload(path: string, fields: Record<string, string>, files: { name: string; type: string; bytes: Uint8Array }[]) {
    const body = new FormData();
    for (const [key, value] of Object.entries(fields)) body.append(key, value);
    for (const f of files) body.append("photo", new Blob([f.bytes], { type: f.type }), f.name);
    const res = await fetch(new URL(path, this.baseUrl), {
      method: "POST",
      headers: { origin: this.baseUrl, ...this.header() },
      body,
      redirect: "manual",
    });
    this.keep(res);
    return res;
  }

  async get(path: string): Promise<{ res: Response; html: string; doc: Document }> {
    const res = await fetch(new URL(path, this.baseUrl), {
      headers: this.header(),
      redirect: "manual",
    });
    this.keep(res);
    const html = await res.text();
    return { res, html, doc: new JSDOM(html).window.document };
  }
}

export const probe = (label: string) => `${label} ${process.hrtime.bigint()}`;

/** Someone who has made a profile under a unique name. */
export async function signedUp(baseUrl: string, label: string): Promise<Person> {
  const person = new Person(baseUrl, probe(label));
  await person.post("/api/me", { name: person.name, timezone: "Australia/Sydney", back: "/me" });
  return person;
}

/** Their friend code, read off their friends page. */
export async function friendCode(person: Person): Promise<string> {
  const { html } = await person.get("/friends");
  return /\/f\/([A-Za-z0-9_-]+)/.exec(html)?.[1] ?? "";
}

/** Make two people friends the way people do: one adds the other's link,
 *  the other accepts. */
export async function befriend(a: Person, b: Person): Promise<void> {
  await b.post("/api/friends", { code: await friendCode(a) });
  const { doc } = await a.get("/friends");
  const request = [...doc.querySelectorAll("#requests li")].find((li) =>
    li.textContent?.includes(b.name),
  );
  const id = request?.querySelector<HTMLInputElement>('input[name="person"]')?.value ?? "";
  await a.post("/api/friends/respond", { person: id, action: "accept" });
}

export const textOf = (doc: Document, selector: string) =>
  doc.querySelector(selector)?.textContent ?? "";
