import { z } from "zod";

export const registerSiteSchema = z.object({
  url: z.string().trim().min(1, "URLを入力してください。"),
});

const fieldSelectorSchema = z.object({
  selector: z.string(),
  attr: z.string().min(1),
});

export const indexRuleSchema = z.object({
  itemSelector: z.string().min(1, "一覧の項目セレクタが必要です。"),
  title: fieldSelectorSchema,
  link: fieldSelectorSchema,
  thumbnail: fieldSelectorSchema.nullable().optional(),
  date: fieldSelectorSchema.nullable().optional(),
  summary: fieldSelectorSchema.nullable().optional(),
  nextPage: fieldSelectorSchema.nullable().optional(),
});

export const detailRuleSchema = z.object({
  title: fieldSelectorSchema.nullable().optional(),
  body: fieldSelectorSchema.nullable().optional(),
  thumbnail: fieldSelectorSchema.nullable().optional(),
  author: fieldSelectorSchema.nullable().optional(),
  date: fieldSelectorSchema.nullable().optional(),
});

export const saveSiteRuleSchema = z.object({
  listUrl: z.string().min(1),
  index: indexRuleSchema,
  detail: detailRuleSchema.nullable().optional(),
});

export const previewIndexRuleSchema = z.object({
  mode: z.literal("index"),
  listUrl: z.string().min(1, "一覧ページのURLが必要です。"),
  index: indexRuleSchema,
});

export const previewDetailRuleSchema = z.object({
  mode: z.literal("detail"),
  detailUrl: z.string().min(1, "記事ページのURLが必要です。"),
  detail: detailRuleSchema,
});

export const previewRuleSchema = z.union([previewIndexRuleSchema, previewDetailRuleSchema]);

export const updateSiteSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  viewMode: z.enum(["card", "grid", "list"]).optional(),
  isEnabled: z.boolean().optional(),
});

export const updateContentSchema = z.object({
  isRead: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isSaved: z.boolean().optional(),
  readProgress: z.number().min(0).max(1).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
});

export const viewProgressSchema = z.object({
  progress: z.number().min(0).max(1).default(0),
});

export const createCollectionSchema = z.object({
  name: z.string().trim().min(1, "コレクション名を入力してください。").max(100),
  description: z.string().trim().max(500).nullable().optional(),
  icon: z.string().trim().max(10).nullable().optional(),
});

export const updateCollectionSchema = createCollectionSchema.partial();

export const addToCollectionSchema = z.object({
  contentId: z.string().min(1),
});

export const updateSettingsSchema = z.object({
  theme: z.enum(["system", "light", "dark"]).optional(),
  fontSize: z.number().int().min(12).max(28).optional(),
  defaultViewMode: z.enum(["card", "grid", "list"]).optional(),
});

export const contentListQuerySchema = z.object({
  siteId: z.string().optional(),
  tag: z.string().optional(),
  collectionId: z.string().optional(),
  type: z.enum(["article", "image", "gallery", "video", "pdf", "link", "unknown"]).optional(),
  favorite: z.coerce.boolean().optional(),
  saved: z.coerce.boolean().optional(),
  unread: z.coerce.boolean().optional(),
  q: z.string().optional(),
  sort: z.enum(["new", "updated", "saved", "title"]).default("new"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
