export type ContentType = "article" | "image" | "gallery" | "video" | "pdf" | "link" | "unknown";
export type ViewMode = "card" | "grid" | "list";
export type FeedType = "rss" | "atom" | "html" | "json" | "unknown";
export type ThemePref = "system" | "light" | "dark";

export interface ContentItemDTO {
  id: string;
  type: ContentType;
  title: string;
  summary: string | null;
  body: string | null;
  url: string;
  canonicalUrl: string | null;
  thumbnailUrl: string | null;
  author: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  isRead: boolean;
  isFavorite: boolean;
  isSaved: boolean;
  readProgress: number;
  tags: string[];
  media: { id: string; url: string; type: string; alt: string | null }[];
  collectionIds: string[];
  site: { id: string; name: string; iconUrl: string | null; domain: string };
}

export interface SiteDTO {
  id: string;
  name: string;
  url: string;
  domain: string;
  iconUrl: string | null;
  description: string | null;
  feedUrl: string | null;
  feedType: FeedType;
  viewMode: ViewMode;
  isEnabled: boolean;
  lastFetchedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  contentCount?: number;
}

export interface CollectionDTO {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionDetailDTO extends CollectionDTO {
  items: ContentItemDTO[];
}

export interface HistoryEntryDTO {
  id: string;
  viewedAt: string;
  progress: number;
  content: ContentItemDTO;
}

export interface TagDTO {
  id: string;
  name: string;
  count: number;
}

export interface SettingsDTO {
  id: number;
  theme: ThemePref;
  fontSize: number;
  defaultViewMode: ViewMode;
}

export interface ContentListResponse {
  items: ContentItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  error: string;
}
