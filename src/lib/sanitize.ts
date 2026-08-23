"use client";

import DOMPurify from "dompurify";

/** Sanitizes externally-fetched article HTML before it is ever rendered via
 * dangerouslySetInnerHTML — RSS/HTML sources are untrusted input and must
 * not be able to run scripts or embed arbitrary frames in this app's origin. */
export function sanitizeArticleHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button"],
    FORBID_ATTR: ["style"],
    ALLOW_DATA_ATTR: false,
  });
}
