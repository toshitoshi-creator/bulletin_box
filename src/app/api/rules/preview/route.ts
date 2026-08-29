import { NextRequest, NextResponse } from "next/server";
import { previewRuleSchema } from "@/lib/validation";
import { handleApiError } from "@/lib/api-response";
import { safeFetchText } from "@/lib/fetch/safeFetch";
import { normalizeUrl, assertValidHttpUrl } from "@/lib/fetch/normalize";
import { applyIndexRule, applyDetailRule, RuleApplyError } from "@/lib/fetch/rule";

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
      const { text, finalUrl } = await safeFetchText(listUrl);
      try {
        const { items, scopedCount, missingFieldCount, duplicateCount } = applyIndexRule(text, finalUrl, data.index);
        return NextResponse.json({
          items: items.slice(0, 50),
          count: items.length,
          scopedCount,
          missingFieldCount,
          duplicateCount,
        });
      } catch (err) {
        if (err instanceof RuleApplyError) {
          return NextResponse.json({ items: [], count: 0, scopedCount: 0, missingFieldCount: 0, duplicateCount: 0, error: err.message });
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
