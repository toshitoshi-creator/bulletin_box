"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-56 lg:w-64 shrink-0 flex-col border-r border-border px-3 py-6 gap-1">
      <div className="px-3 pb-6">
        <span className="text-lg font-semibold tracking-tight text-ink">WEB SHELF</span>
      </div>
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
              active ? "bg-accent-soft text-accent-strong font-medium" : "text-ink-muted hover:bg-surface-alt hover:text-ink"
            )}
            aria-current={active ? "page" : undefined}
          >
            <Icon width={20} height={20} strokeWidth={active ? 2 : 1.75} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}
