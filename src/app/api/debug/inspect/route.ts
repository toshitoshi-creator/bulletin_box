import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import type { CheerioAPI } from "cheerio";
import { safeFetchText } from "@/lib/fetch/safeFetch";
import { assertValidHttpUrl, normalizeUrl } from "@/lib/fetch/normalize";
import { stripNoise, extractListingCandidates } from "@/lib/fetch/html";

/**
 * Diagnostic-only page (not linked from the app UI): fetches a URL and shows
 * the structural signals our HTML listing scraper actually sees — repeated
 * sibling-class groups, elements matching common "interesting" keywords the
 * user has pointed at (title/grid/gallery/tab/...), and what
 * extractListingCandidates() currently returns for it. Meant to be visited
 * directly in a browser to compare against the real page instead of
 * iterating on class-name guesses blind.
 */

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function classifyElements($: CheerioAPI, $clean: ReturnType<CheerioAPI>, keyword: string) {
  const matches: { tag: string; className: string; text: string; linkCount: number }[] = [];
  $clean.find(`[class*="${keyword}" i]`).each((_, el) => {
    const $el = $(el);
    const className = $el.attr("class") ?? "";
    const text = $el.text().trim().replace(/\s+/g, " ").slice(0, 80);
    matches.push({ tag: (el as { tagName?: string }).tagName ?? "?", className, text, linkCount: $el.find("a[href]").length });
  });
  return matches.slice(0, 20);
}

function siblingGroupSummary($: CheerioAPI, $clean: ReturnType<CheerioAPI>) {
  const byParentAndClass = new Map<object, Map<string, { el: object; text: string }[]>>();

  $clean.find("[class]").each((_, el) => {
    const parent = (el as { parent?: object | null }).parent;
    if (!parent) return;
    const className = $(el).attr("class")?.trim();
    if (!className) return;
    let classMap = byParentAndClass.get(parent);
    if (!classMap) {
      classMap = new Map();
      byParentAndClass.set(parent, classMap);
    }
    const group = classMap.get(className) ?? [];
    const text = $(el).text().trim().replace(/\s+/g, " ").slice(0, 60);
    group.push({ el, text });
    classMap.set(className, group);
  });

  const groups: { className: string; count: number; sampleTexts: string[]; hasLinks: boolean }[] = [];
  for (const classMap of byParentAndClass.values()) {
    for (const [className, members] of classMap.entries()) {
      if (members.length < 2) continue;
      groups.push({
        className,
        count: members.length,
        sampleTexts: members.slice(0, 3).map((m) => m.text),
        hasLinks: members.some((m) => $(m.el as never).find("a[href]").length > 0 || $(m.el as never).is("a[href]")),
      });
    }
  }
  groups.sort((a, b) => b.count - a.count);
  return groups.slice(0, 25);
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return new NextResponse("?url=https://example.com/... を指定してください", { status: 400 });
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

  const $ = cheerio.load(text);
  const $clean = stripNoise($);

  const articleCount = $clean.find("article").length;
  const siblingGroups = siblingGroupSummary($, $clean);
  const keywordMatches = ["title", "grid", "gallery", "tab", "list", "card"].map((kw) => ({
    keyword: kw,
    matches: classifyElements($, $clean, kw),
  }));

  let candidates: ReturnType<typeof extractListingCandidates> = [];
  let candidateError: string | null = null;
  try {
    candidates = extractListingCandidates($, finalUrl);
  } catch (err) {
    candidateError = err instanceof Error ? err.message : String(err);
  }

  const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>診断: ${escapeHtml(finalUrl)}</title>
<style>
body { font-family: -apple-system, sans-serif; margin: 0; padding: 16px; background: #16140f; color: #f1ece0; font-size: 14px; line-height: 1.5; }
h1 { font-size: 16px; word-break: break-all; }
h2 { font-size: 14px; margin-top: 28px; border-bottom: 1px solid #3a3324; padding-bottom: 6px; }
.box { background: #201c15; border: 1px solid #3a3324; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
.cls { font-family: monospace; color: #8bc4b0; word-break: break-all; }
.count { color: #b6ac97; font-size: 12px; }
.sample { color: #f1ece0; font-size: 12px; margin-top: 4px; }
.final-list li { margin-bottom: 6px; }
a { color: #8bc4b0; }
</style>
</head><body>
<h1>診断結果: ${escapeHtml(finalUrl)}</h1>

<h2>1. &lt;article&gt;タグの数</h2>
<div class="box">${articleCount} 個</div>

<h2>2. 繰り返し兄弟要素グループ（同じclassが2個以上並んでいるもの）</h2>
${
  siblingGroups.length === 0
    ? "<div class=\"box\">見つかりませんでした</div>"
    : siblingGroups
        .map(
          (g) => `<div class="box">
  <div class="cls">.${escapeHtml(g.className)}</div>
  <div class="count">${g.count}個 ／ リンクあり: ${g.hasLinks ? "はい" : "いいえ"}</div>
  <div class="sample">${g.sampleTexts.map((t) => escapeHtml(t)).join(" | ")}</div>
</div>`
        )
        .join("\n")
}

<h2>3. キーワード別: class名に含まれる要素</h2>
${keywordMatches
  .map(
    (k) => `<h3 style="font-size:13px;color:#b6ac97">「${escapeHtml(k.keyword)}」を含むclass（最大20件）</h3>
${
  k.matches.length === 0
    ? '<div class="box">見つかりませんでした</div>'
    : k.matches
        .map(
          (m) => `<div class="box">
  <div class="cls">&lt;${escapeHtml(m.tag)} class="${escapeHtml(m.className)}"&gt;</div>
  <div class="count">リンク数: ${m.linkCount}</div>
  <div class="sample">${escapeHtml(m.text)}</div>
</div>`
        )
        .join("\n")
}`
  )
  .join("\n")}

<h2>4. 今のアプリが実際に抽出する記事一覧</h2>
${
  candidateError
    ? `<div class="box">エラー: ${escapeHtml(candidateError)}</div>`
    : `<div class="box">${candidates.length} 件</div>
<ul class="final-list">
${candidates
  .slice(0, 40)
  .map((c) => `<li><a href="${escapeHtml(c.url)}">${escapeHtml(c.title)}</a></li>`)
  .join("\n")}
</ul>`
}

</body></html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
