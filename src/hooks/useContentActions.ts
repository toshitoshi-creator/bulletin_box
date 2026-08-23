"use client";

import { useCallback } from "react";
import { mutate } from "swr";
import { api } from "@/lib/api-client";
import type { ContentItemDTO } from "@/lib/api-types";

function revalidateContentCaches() {
  mutate((key) => typeof key === "string" && key.startsWith("/api/content"), undefined, { revalidate: true });
  mutate((key) => typeof key === "string" && key.startsWith("/api/history"), undefined, { revalidate: true });
  mutate((key) => typeof key === "string" && key.startsWith("/api/collections"), undefined, { revalidate: true });
  mutate((key) => typeof key === "string" && key.startsWith("/api/tags"), undefined, { revalidate: true });
}

export function useContentActions() {
  const toggleFavorite = useCallback(async (item: ContentItemDTO) => {
    await api.content.update(item.id, { isFavorite: !item.isFavorite });
    revalidateContentCaches();
  }, []);

  const toggleSaved = useCallback(async (item: ContentItemDTO) => {
    await api.content.update(item.id, { isSaved: !item.isSaved });
    revalidateContentCaches();
  }, []);

  const toggleRead = useCallback(async (item: ContentItemDTO) => {
    await api.content.update(item.id, { isRead: !item.isRead });
    revalidateContentCaches();
  }, []);

  const setTags = useCallback(async (item: ContentItemDTO, tags: string[]) => {
    await api.content.update(item.id, { tags });
    revalidateContentCaches();
  }, []);

  return { toggleFavorite, toggleSaved, toggleRead, setTags, revalidateContentCaches };
}
