import dns from "node:dns/promises";
import net from "node:net";

/**
 * Blocks requests to loopback / private / link-local / cloud-metadata addresses so a
 * registered site URL can't be used to probe internal infrastructure (SSRF).
 */
export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return false;
  const [a, b] = parts;
  if (a === 127) return true; // loopback
  if (a === 10) return true; // private
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 0) return true;
  return false;
}

function isBlockedIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === "::1") return true; // loopback
  if (normalized.startsWith("fe80:")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // unique local
  if (normalized.startsWith("::ffff:")) {
    const v4 = normalized.split(":").pop();
    if (v4 && isBlockedIPv4(v4)) return true;
  }
  return false;
}

export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIPv4(ip);
  if (net.isIPv6(ip)) return isBlockedIPv6(ip);
  return false;
}

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/** Double-gated escape hatch so local fixture servers can be registered while developing
 * or testing the fetch pipeline (see prisma/../Fixtures, spec item 96). Requires both a
 * non-production NODE_ENV and an explicit opt-in env var, so it can never be live in a
 * deployed build even if the env var is set by mistake. */
function allowPrivateHostsForTesting(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.WEBSHELF_ALLOW_PRIVATE_HOSTS === "1";
}

export async function assertUrlIsSafe(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new BlockedUrlError("URLの形式が正しくありません。");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BlockedUrlError("http または https の URL のみ登録できます。");
  }

  if (allowPrivateHostsForTesting()) return url;

  const hostname = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new BlockedUrlError("このホストへのアクセスは許可されていません。");
  }

  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new BlockedUrlError("このアドレスへのアクセスは許可されていません。");
    }
    return url;
  }

  try {
    const records = await dns.lookup(hostname, { all: true, verbatim: false });
    if (records.length === 0) {
      throw new BlockedUrlError("ホスト名を解決できませんでした。");
    }
    if (records.some((r) => isBlockedIp(r.address))) {
      throw new BlockedUrlError("このホストへのアクセスは許可されていません。");
    }
  } catch (err) {
    if (err instanceof BlockedUrlError) throw err;
    throw new BlockedUrlError("ホスト名を解決できませんでした。");
  }

  return url;
}
