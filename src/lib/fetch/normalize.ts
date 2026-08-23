import crypto from "node:crypto";

export class InvalidUrlError extends Error {}

/** Validates that a string is a well-formed http(s) URL, throwing a
 * user-facing Japanese message instead of the native "Invalid URL" error. */
export function assertValidHttpUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new InvalidUrlError("URLの形式が正しくありません。");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidUrlError("http または https の URL を入力してください。");
  }
}

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "ref",
  "ref_src",
];

export function normalizeUrl(rawUrl: string, base?: string): string {
  try {
    const url = new URL(rawUrl, base);
    for (const p of TRACKING_PARAMS) url.searchParams.delete(p);
    url.hash = "";
    let s = url.toString();
    if (s.endsWith("?")) s = s.slice(0, -1);
    return s;
  } catch {
    return rawUrl;
  }
}

export function toAbsoluteUrl(maybeRelative: string | undefined | null, base: string): string | null {
  if (!maybeRelative) return null;
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return null;
  }
}

export function contentHash(parts: (string | null | undefined)[]): string {
  const joined = parts.filter(Boolean).join("|");
  return crypto.createHash("sha256").update(joined).digest("hex");
}

export function parseDateLoose(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // Unix timestamp (seconds or ms)
  if (/^\d{10}$/.test(trimmed)) return new Date(Number(trimmed) * 1000);
  if (/^\d{13}$/.test(trimmed)) return new Date(Number(trimmed));

  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

export function stripHtml(html: string | undefined | null): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1).trimEnd() + "…";
}
