import { NextRequest, NextResponse } from "next/server";
import { previewRuleSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-response";
import { safeFetchText } from "@/lib/fetch/safeFetch";
import { normalizeUrl, assertValidHttpUrl } from "@/lib/fetch/normalize";
import { applyDetailRule, fetchAllPages, RuleApplyError } from "@/lib/fetch/rule";

/** Preview follows pagination too (so the user can confirm the next-page
 * link actually works) but at a much smaller cap than the real fetch, to
 * keep the interactive wizard responsive. */
const PREVIEW_MAX_PAGES = 3;

/**
 * Live "what would actually be extracted" preview for the Rule Editor
 * wizard, reusing the exact same applyIndexRule/applyDetailRule code path
 * that runs in production (via refreshSite -> fetchWithRule), so what the
 * user sees while building a rule matches what they'll get after saving it.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = previewRuleSchema.parse(body);

    if (data.mode === "index") {
      const listUrl = normalizeUrl(data.listUrl);
      assertValidHttpUrl(listUrl);
      try {
        const { items, scopedCount, missingFieldCount, duplicateCount, pagesFetched } = await fetchAllPages(
          listUrl,
          data.index,
          PREVIEW_MAX_PAGES
        );
        return NextResponse.json({
          items: items.slice(0, 50),
          count: items.length,
          scopedCount,
          missingFieldCount,
          duplicateCount,
          pagesFetched,
        });
      } catch (err) {
        if (err instanceof RuleApplyError) {
          return NextResponse.json({
            items: [],
            count: 0,
            scopedCount: 0,
            missingFieldCount: 0,
            duplicateCount: 0,
            pagesFetched: 0,
            error: err.message,
          });
        }
        throw err;
      }
    }

    const detailUrl = normalizeUrl(data.detailUrl);
    assertValidHttpUrl(detailUrl);
    const { text, finalUrl } = await safeFetchText(detailUrl);
    const fields = applyDetailRule(text, finalUrl, data.detail);
    return NextResponse.json({ fields });
  } catch (err) {
    return handleApiError(err);
  }
}
