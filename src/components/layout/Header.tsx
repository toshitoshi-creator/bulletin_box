"use client";

import Link from "next/link";
import { SearchIcon } from "@/components/icons";

export function Header() {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-bg/95 px-4 py-3 backdrop-blur md:hidden"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
    >
      <Link href="/" className="text-base font-semibold tracking-tight text-ink">
        WEB SHELF
      </Link>
      <Link
        href="/search"
        aria-label="検索"
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted hover:bg-surface-alt hover:text-ink"
      >
        <SearchIcon width={20} height={20} />
      </Link>
    </header>
  );
}
