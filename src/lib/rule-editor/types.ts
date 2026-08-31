/** Client-safe mirror of the server-side rule types (src/lib/fetch/rule.ts).
 * Kept as a separate file so client components never import that module
 * directly, which would pull cheerio into the browser bundle. */

export interface FieldSelector {
  selector: string;
  attr: "text" | "href" | "src" | string;
}

export interface IndexRule {
  itemSelector: string;
  title: FieldSelector;
  link: FieldSelector;
  thumbnail?: FieldSelector | null;
  date?: FieldSelector | null;
  summary?: FieldSelector | null;
  /** Selector for a "next page" link on the list page itself, followed to
   * pull in items from subsequent pages too. */
  nextPage?: FieldSelector | null;
  /** Alternative to nextPage for sites whose pagination is client-side
   * JavaScript with no real link to tap (e.g. a Vue/Quasar paginator):
   * increments a numeric query parameter already present in listUrl
   * (e.g. ?page=1) instead. */
  pageParam?: { name: string; maxPages: number } | null;
}

export interface DetailRule {
  title?: FieldSelector | null;
  body?: FieldSelector | null;
  thumbnail?: FieldSelector | null;
  author?: FieldSelector | null;
  date?: FieldSelector | null;
}

export interface SiteRuleDTO {
  id: string;
  siteId: string;
  listUrl: string;
  index: IndexRule;
  detail: DetailRule | null;
  enabled: boolean;
}

export interface PreviewIndexItem {
  title: string;
  url: string;
  thumbnailUrl: string | null;
  summary: string | null;
  publishedAt: string | null;
}

export interface PreviewDetailFields {
  title: string;
  body: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  summary: string | null;
}
