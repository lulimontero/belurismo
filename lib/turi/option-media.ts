// Node-only data access: import from server modules, never from the chat client.
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import type { LookupAddress } from "node:dns";

type OptionImage = { url: string; sourceUrl: string; alt?: string };
type ImageCandidate = { url: string; alt?: string };

const MAX_HTML_BYTES = 600 * 1024;
const TIMEOUT_MS = 4000;
const MAX_CACHE_ENTRIES = 128;
const cache = new Map<string, { expires: number; image?: OptionImage }>();
const pending = new Map<string, Promise<OptionImage | undefined>>();

function isMapMediaUrl(url: URL): boolean {
  const host = url.hostname.replace(/\.$/, "").toLowerCase();
  const googleHost = /(?:^|\.)google\.(?:com|[a-z]{2}|com\.[a-z]{2}|co\.[a-z]{2})$/.test(host);
  return (googleHost && (host.startsWith("maps.") || /^\/maps(?:\/|$)/i.test(url.pathname))) ||
    /(?:^|\.)maps\.googleapis\.com$/.test(host) ||
    /(?:^|\.)maps\.googleusercontent\.com$/.test(host) ||
    host === "maps.app.goo.gl" || (host === "goo.gl" && /^\/maps(?:\/|$)/i.test(url.pathname));
}

/** Reject special-use addresses, including IPv4-mapped IPv6 and transition ranges. */
export function isPublicMediaAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b, c] = address.split(".").map(Number);
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || (b === 0 && (c === 0 || c === 2)) || (b === 88 && c === 99))) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113)
    );
  }
  if (isIP(address) !== 6 || address.includes(".")) return false;
  const halves = address.toLowerCase().split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
  const groups = halves.length === 1
    ? left
    : [...left, ...Array(8 - left.length - right.length).fill("0"), ...right];
  const [first, second] = groups.map((part) => parseInt(part, 16));
  return first >= 0x2000 && first <= 0x3fff &&
    !(first === 0x2001 && (second < 0x200 || second === 0xdb8)) &&
    first !== 0x2002 && !(first === 0x3fff && second < 0x1000);
}

/** Syntax checks are repeated after every redirect; DNS is checked separately. */
export function publicMediaUrl(value: string, base?: string): URL | undefined {
  if (!value || value.length > 4096 || /[\u0000-\u0020\u007f\\]/.test(value)) return;
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return;
    const authority = value.match(/^(?:https:)?\/\/([^/]+)/i)?.[1];
    if (authority?.includes("@")) return;
    const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
    if (isIP(host)) {
      if (!isPublicMediaAddress(host)) return;
    } else if (
      !host.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|home|lan|test|invalid|example|onion)$/.test(host) ||
      !/^[a-z0-9.-]+$/.test(host)
    ) return;
    // Maps search previews and static maps are not photographs of an option.
    // Reject these before DNS/network access, including redirect destinations.
    if (isMapMediaUrl(url)) return;
    url.hash = "";
    return url;
  } catch {
    return;
  }
}

function decodeHtml(value: string): string {
  return value.replace(/&(#(?:x[0-9a-f]+|\d+)|amp|quot|apos|lt|gt|nbsp);/gi, (entity, name: string) => {
    const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };
    if (!name.startsWith("#")) return named[name.toLowerCase()] ?? entity;
    const code = name[1]?.toLowerCase() === "x" ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function attributes(tag: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g)) {
    result[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return result;
}

function plausiblePhoto(url: URL): boolean {
  let path = url.pathname;
  try { path = decodeURIComponent(path); } catch { return false; }
  if (/\.(?:svg|gif|ico)(?:$|\/)/i.test(path) || /(?:^|[\W_])(?:logo|favicon|spacer|pixel|tracking|tracker)(?:[\W_]|$)/i.test(path)) return false;
  if (/(?:^|\/)(?:maps?|static[-_]?maps?)(?:\.[a-z0-9]{2,5}|\/|$)/i.test(path) || url.searchParams.has("maptype")) return false;
  for (const key of ["w", "width", "h", "height"]) {
    const size = Number(url.searchParams.get(key));
    if (url.searchParams.has(key) && size > 0 && size <= 16) return false;
  }
  return !/svg/i.test(url.searchParams.get("format") ?? url.searchParams.get("fm") ?? "");
}

/** Uses only images explicitly declared by the source page; no stock-photo fallback. */
export function extractOptionImageCandidates(html: string, sourceUrl: string): ImageCandidate[] {
  if (!publicMediaUrl(sourceUrl)) return [];
  const metas = new Map<string, string>();
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    const key = (attrs.property ?? attrs.name ?? "").toLowerCase();
    if (attrs.content && !metas.has(key)) metas.set(key, attrs.content);
  }
  const raw: ImageCandidate[] = [];
  for (const key of ["og:image:secure_url", "og:image", "og:image:url", "twitter:image", "twitter:image:src"]) {
    const url = metas.get(key);
    if (url) raw.push({ url, alt: metas.get(key.startsWith("og:") ? "og:image:alt" : "twitter:image:alt") });
  }
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.rel?.toLowerCase().split(/\s+/).includes("image_src") && attrs.href) raw.push({ url: attrs.href });
  }
  let visited = 0;
  const visit = (value: unknown, depth = 0) => {
    if (!value || depth > 8 || ++visited > 300) return;
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return; }
    if (typeof value !== "object") return;
    const record = value as Record<string, unknown>;
    const images = [record.image, record.thumbnailUrl].flatMap((value) => Array.isArray(value) ? value : [value]);
    for (const image of images) {
      if (typeof image === "string") raw.push({ url: image });
      else if (image && typeof image === "object") {
        const item = image as Record<string, unknown>;
        const url = item.contentUrl ?? item.url;
        if (typeof url === "string") raw.push({ url, alt: typeof item.caption === "string" ? item.caption : undefined });
      }
    }
    for (const [key, child] of Object.entries(record)) {
      if (!["image", "thumbnailUrl", "logo", "author", "publisher", "provider"].includes(key)) visit(child, depth + 1);
    }
  };
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    if (attributes(match[1]).type?.toLowerCase() !== "application/ld+json") continue;
    try { visit(JSON.parse(match[2])); } catch { /* A malformed block is not a usable source. */ }
  }
  const seen = new Set<string>();
  return raw.flatMap((candidate) => {
    const url = publicMediaUrl(candidate.url.trim(), sourceUrl);
    if (!url || !plausiblePhoto(url) || seen.has(url.href)) return [];
    seen.add(url.href);
    return [{ url: url.href, alt: candidate.alt?.replace(/\s+/g, " ").trim().slice(0, 240) }];
  }).slice(0, 8);
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return; }
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

async function publicAddresses(url: URL, signal: AbortSignal): Promise<LookupAddress[]> {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(host);
  const addresses = family ? [{ address: host, family }] : await abortable(lookup(host, { all: true, verbatim: true }), signal);
  if (!addresses.length || addresses.some(({ address }) => !isPublicMediaAddress(address))) throw new Error("Non-public media host");
  return addresses.sort((a, b) => a.family - b.family);
}

/** Read metadata without buffering the rest of a large booking page. */
export async function readOptionHtmlPrefix(chunks: AsyncIterable<Uint8Array>): Promise<string> {
  const prefix: Buffer[] = [];
  let bytes = 0;
  let tail = "";
  for await (const chunk of chunks) {
    const part = Buffer.from(chunk.buffer, chunk.byteOffset, Math.min(chunk.byteLength, MAX_HTML_BYTES - bytes));
    prefix.push(part);
    bytes += part.length;
    // Retain a small ASCII tail so </head> can span network chunks.
    const boundary = tail + part.toString("utf8");
    if (bytes >= MAX_HTML_BYTES || /<\/head\s*>/i.test(boundary)) break;
    tail = boundary.slice(-32);
  }
  return Buffer.concat(prefix, bytes).toString("utf8");
}

async function readPage(url: URL, signal: AbortSignal): Promise<{ html?: string; redirect?: string }> {
  const [address] = await publicAddresses(url, signal);
  return new Promise((resolve, reject) => {
    let readingResponse = false;
    const req = request(url, {
      signal,
      agent: false,
      family: address.family,
      // Pin the validated DNS result to this connection, preventing DNS rebinding.
      lookup: (_host, _options, callback) => callback(null, address.address, address.family),
      headers: { Accept: "text/html,application/xhtml+xml", "Accept-Encoding": "identity", "User-Agent": "TuriBelo/1.0 (travel option preview)" },
    }, (response) => {
      readingResponse = true;
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = response.headers.location;
        response.destroy();
        resolve({ redirect: location });
        return;
      }
      if (status !== 200 || !/^(?:text\/html|application\/xhtml\+xml)(?:;|$)/i.test(response.headers["content-type"] ?? "") ||
        (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity")) {
        response.destroy(); reject(new Error("Not a bounded HTML page")); return;
      }
      // Content-Length can be megabytes: only the bounded metadata prefix matters.
      // Breaking the IncomingMessage iterator closes the remaining network body.
      void readOptionHtmlPrefix(response).then((html) => resolve({ html }), reject);
    });
    // Once headers arrive, the body iterator owns errors, including aborts.
    // Its deliberate early close must not turn a usable prefix into a failure.
    req.on("error", (error) => { if (!readingResponse) reject(error); });
    req.end();
  });
}

async function findImage(source: URL): Promise<OptionImage | undefined> {
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  let page = source;
  for (let redirects = 0; redirects <= 3; redirects++) {
    const result = await readPage(page, signal);
    if (result.redirect) {
      const next = publicMediaUrl(result.redirect, page.href);
      if (!next || redirects === 3) return;
      page = next;
      continue;
    }
    if (!result.html) return;
    for (const image of extractOptionImageCandidates(result.html, page.href)) {
      const imageUrl = publicMediaUrl(image.url);
      if (!imageUrl) continue;
      try {
        await publicAddresses(imageUrl, signal);
        return { ...image, sourceUrl: page.href };
      } catch {
        if (signal.aborted) return;
      }
    }
    return;
  }
}

export async function resolveOptionImage(sourceUrl: string): Promise<OptionImage | undefined> {
  const source = publicMediaUrl(sourceUrl);
  if (!source) return;
  const existing = cache.get(source.href);
  if (existing && existing.expires > Date.now()) return existing.image;
  const active = pending.get(source.href);
  if (active) return active;
  // Bound simultaneous, untrusted sources as well as the completed cache.
  if (pending.size >= 16) return;
  const work = findImage(source).catch(() => undefined).then((image) => {
    cache.delete(source.href);
    if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(source.href, { image, expires: Date.now() + (image ? 30 * 60000 : 60000) });
    return image;
  }).finally(() => pending.delete(source.href));
  pending.set(source.href, work);
  return work;
}
