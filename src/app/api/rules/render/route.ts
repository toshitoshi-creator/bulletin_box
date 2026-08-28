import { NextRequest, NextResponse } from "next/server";
import { safeFetchText } from "@/lib/fetch/safeFetch";
import { assertValidHttpUrl, normalizeUrl } from "@/lib/fetch/normalize";

/**
 * Serves a sanitized copy of an external page from OUR OWN origin so the
 * Rule Editor can embed it in a same-origin iframe: the parent page's JS can
 * then read `iframe.contentDocument` directly (no postMessage bridge
 * needed) to highlight hovered elements and compute selectors on click.
 *
 * All scripts, inline event handlers, javascript: URIs, and any CSP/refresh
 * meta tags are stripped as a first layer of defense. The real backstop is
 * the Content-Security-Policy response header below (script-src 'none'):
 * unlike the iframe's sandbox attribute, a real CSP header applies from
 * byte one with no document-order race, and — unlike our own regex
 * stripping — it's enforced by the browser engine itself, so it still
 * holds even against markup our regex fails to catch.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("?url=... を指定してください", { status: 400 });
  }

  let normalized: string;
  try {
    normalized = normalizeUrl(url);
    assertValidHttpUrl(normalized);
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : "URLが不正です", { status: 400 });
  }

  let text: string;
  let finalUrl: string;
  try {
    const res = await safeFetchText(normalized);
    text = res.text;
    finalUrl = res.finalUrl;
  } catch (err) {
    return new NextResponse(`取得失敗: ${err instanceof Error ? err.message : String(err)}`, { status: 502 });
  }

  let sanitized = text
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<script\b[^>]*\/?>(?!<\/script>)/gi, "")
    .replace(/\son\w+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/\son\w+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "")
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, `$1=$2#$2`)
    .replace(/<meta\s+http-equiv=["']?(refresh|content-security-policy)["']?[^>]*>/gi, "");

  const baseTag = `<base href="${finalUrl.replace(/"/g, "&quot;")}">`;
  if (/<head[^>]*>/i.test(sanitized)) {
    sanitized = sanitized.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else if (/<html[^>]*>/i.test(sanitized)) {
    sanitized = sanitized.replace(/<html([^>]*)>/i, `<html$1><head>${baseTag}</head>`);
  } else {
    sanitized = `<head>${baseTag}</head>${sanitized}`;
  }

  return new NextResponse(sanitized, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "script-src 'none'; object-src 'none';",
    },
  });
}
