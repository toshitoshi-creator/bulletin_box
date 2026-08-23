import {
  CollectionIcon,
  HistoryIcon,
  HomeIcon,
  LibraryIcon,
  SettingsIcon,
} from "@/components/icons";

export const NAV_ITEMS = [
  { href: "/", label: "ホーム", icon: HomeIcon },
  { href: "/library", label: "ライブラリ", icon: LibraryIcon },
  { href: "/collections", label: "コレクション", icon: CollectionIcon },
  { href: "/history", label: "履歴", icon: HistoryIcon },
  { href: "/settings", label: "設定", icon: SettingsIcon },
] as const;
