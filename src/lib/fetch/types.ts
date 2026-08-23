export type FeedType = "rss" | "atom" | "html" | "json" | "unknown";

export type ExtractedContentType =
  | "article"
  | "image"
  | "gallery"
  | "video"
  | "pdf"
  | "link"
  | "unknown";

export interface ExtractedItem {
  title: string;
  url: string;
  summary?: string | null;
  body?: string | null;
  thumbnailUrl?: string | null;
  author?: string | null;
  publishedAt?: Date | null;
  guid?: string | null;
  type: ExtractedContentType;
}

export interface ExtractionResult {
  items: ExtractedItem[];
  parser: FeedType;
  confidence: number;
  warnings: string[];
  errors: string[];
}

export interface SiteDiscovery {
  feedUrl: string | null;
  feedType: FeedType;
  siteName: string;
  iconUrl: string | null;
  description: string | null;
  finalUrl: string;
}
