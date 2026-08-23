import type {
  CollectionDetailDTO,
  CollectionDTO,
  ContentItemDTO,
  ContentListResponse,
  HistoryEntryDTO,
  SettingsDTO,
  SiteDTO,
  TagDTO,
} from "./api-types";

export class ApiRequestError extends Error {}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(data.error || "エラーが発生しました。");
  }
  return data as T;
}

export const fetcher = <T>(url: string) => request<T>(url);

export const api = {
  sites: {
    list: () => request<{ sites: SiteDTO[] }>("/api/sites"),
    discover: (url: string) =>
      request<{
        url: string;
        domain: string;
        name: string;
        iconUrl: string | null;
        description: string | null;
        feedUrl: string | null;
        feedType: string;
      }>("/api/sites/discover", { method: "POST", body: JSON.stringify({ url }) }),
    get: (id: string) => request<{ site: SiteDTO }>(`/api/sites/${id}`),
    register: (url: string) =>
      request<{ site: SiteDTO; itemCount: number; warnings: string[]; errors: string[] }>("/api/sites", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
    update: (id: string, data: Partial<Pick<SiteDTO, "name" | "description" | "viewMode" | "isEnabled">>) =>
      request<{ site: SiteDTO }>(`/api/sites/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (id: string) => request<{ ok: true }>(`/api/sites/${id}`, { method: "DELETE" }),
    refresh: (id: string) =>
      request<{ itemCount: number; warnings: string[]; errors: string[] }>(`/api/sites/${id}/refresh`, {
        method: "POST",
      }),
  },
  content: {
    list: (params: Record<string, string | number | boolean | undefined>) => {
      const search = new URLSearchParams();
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "") search.set(k, String(v));
      });
      return request<ContentListResponse>(`/api/content?${search.toString()}`);
    },
    get: (id: string) => request<{ item: ContentItemDTO }>(`/api/content/${id}`),
    recordView: (id: string) => request<{ ok: true }>(`/api/content/${id}/view`, { method: "POST" }),
    update: (
      id: string,
      data: Partial<{
        isRead: boolean;
        isFavorite: boolean;
        isSaved: boolean;
        readProgress: number;
        tags: string[];
      }>
    ) => request<{ item: ContentItemDTO }>(`/api/content/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },
  collections: {
    list: () => request<{ collections: CollectionDTO[] }>("/api/collections"),
    get: (id: string) => request<{ collection: CollectionDetailDTO }>(`/api/collections/${id}`),
    create: (data: { name: string; description?: string | null; icon?: string | null }) =>
      request<{ collection: CollectionDTO }>("/api/collections", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: Partial<{ name: string; description: string | null; icon: string | null }>) =>
      request<{ collection: CollectionDTO }>(`/api/collections/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    remove: (id: string) => request<{ ok: true }>(`/api/collections/${id}`, { method: "DELETE" }),
    addItem: (id: string, contentId: string) =>
      request(`/api/collections/${id}/items`, { method: "POST", body: JSON.stringify({ contentId }) }),
    removeItem: (id: string, contentId: string) =>
      request(`/api/collections/${id}/items/${contentId}`, { method: "DELETE" }),
  },
  tags: {
    list: () => request<{ tags: TagDTO[] }>("/api/tags"),
  },
  history: {
    list: () => request<{ entries: HistoryEntryDTO[] }>("/api/history"),
    clear: () => request<{ ok: true }>("/api/history", { method: "DELETE" }),
    remove: (id: string) => request<{ ok: true }>(`/api/history/${id}`, { method: "DELETE" }),
  },
  settings: {
    get: () => request<{ settings: SettingsDTO }>("/api/settings"),
    update: (data: Partial<Pick<SettingsDTO, "theme" | "fontSize" | "defaultViewMode">>) =>
      request<{ settings: SettingsDTO }>("/api/settings", { method: "PATCH", body: JSON.stringify(data) }),
  },
  data: {
    clearAll: () => request<{ ok: true }>("/api/data", { method: "DELETE" }),
    importFile: async (file: File) => {
      const text = await file.text();
      return request<{ sitesImported: number; itemsImported: number; collectionsImported: number }>(
        "/api/data/import",
        { method: "POST", body: text }
      );
    },
  },
};
