"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { NAV_ITEMS } from "./nav-items";

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-surface/95 backdrop-blur supports-backdrop-blur:bg-surface/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="主要ナビゲーション"
    >
      <ul className="grid grid-cols-5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px]"
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  width={22}
                  height={22}
                  className={clsx("transition-colors", active ? "text-accent" : "text-ink-faint")}
                  strokeWidth={active ? 2 : 1.75}
                />
                <span className={clsx(active ? "text-accent font-medium" : "text-ink-muted")}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
