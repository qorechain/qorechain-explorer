/**
 * Builds the upstream URL for the /api/lcd proxy, or returns null when the
 * request must be refused.
 *
 * The allowlist used to be checked on the raw joined path, and `fetch` resolved
 * `..` afterwards, so /api/lcd/cosmos/..%2fibc/... (and %2e%2e variants) reached
 * paths outside the allowlist. Now each segment is decoded first and rejected if
 * it is `.` or `..` or still carries a slash or backslash; the URL is built with
 * `new URL()` against the network's REST base, and the allowlist and origin are
 * checked on the parsed result, which is what is actually fetched.
 *
 * The explorer itself only ever sends plain segments (addresses, heights,
 * hashes) and puts everything else in the query string, so nothing legitimate
 * needs an encoded slash or a dot segment.
 */

export const ALLOWED_PREFIXES = ["cosmos/", "cosmwasm/", "qorechain/"];

function decodeFully(raw: string): string | null {
  // Undo double encoding too (%252e -> %2e -> .), bounded.
  let cur = raw;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(cur);
    } catch {
      return null;
    }
    if (next === cur) return cur;
    cur = next;
  }
  return /%[0-9a-f]{2}/i.test(cur) ? null : cur;
}

export function lcdTarget(rest: string, segments: string[], search: string): URL | null {
  if (segments.length === 0) return null;
  const clean: string[] = [];
  for (const raw of segments) {
    const seg = decodeFully(raw);
    if (seg === null || seg === "" || seg === "." || seg === "..") return null;
    if (seg.includes("/") || seg.includes("\\")) return null;
    clean.push(seg);
  }

  const base = new URL(rest.endsWith("/") ? rest : `${rest}/`);
  const target = new URL(clean.map(encodeURIComponent).join("/"), base);
  target.search = search;

  if (target.origin !== base.origin) return null;
  if (!target.pathname.startsWith(base.pathname)) return null;
  const relative = target.pathname.slice(base.pathname.length);
  if (!ALLOWED_PREFIXES.some((p) => relative.startsWith(p))) return null;
  return target;
}
