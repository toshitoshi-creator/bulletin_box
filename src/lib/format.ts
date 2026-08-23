import { formatDistanceToNow, format, isThisYear } from "date-fns";
import { ja } from "date-fns/locale";

export function formatRelative(dateIso: string | null): string {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return formatDistanceToNow(date, { addSuffix: true, locale: ja });
}

export function formatDate(dateIso: string | null): string {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, isThisYear(date) ? "M月d日" : "yyyy年M月d日", { locale: ja });
}

export function formatDateTime(dateIso: string | null): string {
  if (!dateIso) return "";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "yyyy年M月d日 HH:mm", { locale: ja });
}
