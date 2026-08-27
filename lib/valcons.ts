///// Date : 2026-08-27 | Changes : Derive the valcons address from a consensus pubkey (SCRUM-243) | Who : Liviu Epure

import { createHash } from "crypto";

/**
 * Derive a validator's consensus address (`qorvalcons1…`) from its ed25519
 * consensus public key.
 *
 * This exists because nothing on the chain links a validator to its signing
 * record: `/staking/validators` gives the operator address and the consensus
 * pubkey, while `/slashing/signing_infos` is keyed by the consensus ADDRESS and
 * carries no way back to the operator. The bridge between them is
 * `sha256(pubkey)[0..20]`, the standard consensus-engine derivation for an
 * ed25519 validator address — so uptime and missed-block data are unreachable
 * without doing it here.
 *
 * Server-side only: it needs node's crypto.
 */

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function polymod(values: number[]): number {
  const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const v of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) >> 5);
  out.push(0);
  for (let i = 0; i < hrp.length; i++) out.push(hrp.charCodeAt(i) & 31);
  return out;
}

/** Regroup 8-bit bytes into the 5-bit groups bech32 encodes. */
function convertBits(data: Uint8Array): number[] {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const value of data) {
    acc = (acc << 8) | value;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out.push((acc >> bits) & 31);
    }
  }
  // A trailing partial group is padded, which is correct for encoding.
  if (bits > 0) out.push((acc << (5 - bits)) & 31);
  return out;
}

export function bech32Encode(hrp: string, data: Uint8Array): string {
  const words = convertBits(data);
  const checksum = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1;
  const cs: number[] = [];
  for (let i = 0; i < 6; i++) cs.push((checksum >> (5 * (5 - i))) & 31);
  return `${hrp}1${[...words, ...cs].map((w) => CHARSET[w]).join("")}`;
}

/**
 * `{"@type":"/cosmos.crypto.ed25519.PubKey","key":"<base64>"}` → `qorvalcons1…`.
 * Returns null for a key type whose address is derived differently, rather than
 * returning a plausible-looking wrong address.
 */
export function consensusAddress(
  pubkey: { "@type"?: string; key?: string } | null | undefined,
  prefix = "qorvalcons",
): string | null {
  if (!pubkey?.key) return null;
  if (pubkey["@type"] && !pubkey["@type"].includes("ed25519")) return null;
  try {
    const raw = Buffer.from(pubkey.key, "base64");
    const hash = createHash("sha256").update(raw).digest();
    return bech32Encode(prefix, hash.subarray(0, 20));
  } catch {
    return null;
  }
}

/** Inverse of convertBits: 5-bit groups back to bytes, dropping the pad. */
function convertBitsBack(words: number[]): Uint8Array | null {
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const w of words) {
    if (w < 0 || w > 31) return null;
    acc = (acc << 5) | w;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  // Leftover bits must be padding: too many, or non-zero, means a malformed string.
  if (bits >= 5 || ((acc << (8 - bits)) & 0xff) !== 0) return null;
  return Uint8Array.from(out);
}

/** Decode any bech32 string to its payload bytes, ignoring the prefix. */
export function bech32Decode(s: string): Uint8Array | null {
  const sep = s.lastIndexOf("1");
  if (sep < 1 || sep + 7 > s.length) return null;
  const words: number[] = [];
  for (const ch of s.slice(sep + 1)) {
    const idx = CHARSET.indexOf(ch);
    if (idx === -1) return null;
    words.push(idx);
  }
  return convertBitsBack(words.slice(0, -6));
}

/**
 * `qorvaloper1…` → `qor1…`. Both encode the same 20 bytes under a different
 * prefix, so the account address can be recovered from the operator address
 * with no lookup. The checksum depends on the prefix, so it is recomputed
 * rather than the string being spliced.
 */
export function valoperToAccount(valoper: string, prefix = "qor"): string | null {
  const bytes = bech32Decode(valoper);
  return bytes ? bech32Encode(prefix, bytes) : null;
}
