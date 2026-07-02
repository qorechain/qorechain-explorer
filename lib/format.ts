/**
 * Formatting helpers shared by explorer views.
 * @file lib/format.ts
 */

/** uqor (6 decimals) → QOR display string. */
export function formatQor(uqor: string | number | bigint, maxFrac = 2): string {
  const v = BigInt(uqor || 0);
  const whole = v / 1_000_000n;
  const frac = Number(v % 1_000_000n) / 1_000_000;
  const n = Number(whole) + frac;
  return n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxFrac,
  });
}

export function truncateMiddle(s: string, len = 8): string {
  if (!s) return "—";
  if (s.length <= len * 2 + 3) return s;
  return `${s.slice(0, len)}…${s.slice(-len)}`;
}

export function timeAgo(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "just now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/** Detect what a search term refers to and return its route. */
export function searchRoute(term: string): string | null {
  const t = term.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return `/block/${t}`;
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(t)) return `/tx/${t.replace(/^0x/, "").toUpperCase()}`;
  if (/^qor1[a-z0-9]{20,}$/.test(t) || /^0x[0-9a-fA-F]{40}$/.test(t)) {
    return `/address/${t}`;
  }
  if (/^qorvaloper1[a-z0-9]{20,}$/.test(t)) return `/validators`;
  return null;
}
