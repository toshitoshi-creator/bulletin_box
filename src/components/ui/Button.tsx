import type { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "md" ? "px-4 py-2.5 text-sm" : "px-3 py-1.5 text-xs",
        variant === "primary" && "bg-accent text-white hover:bg-accent-strong",
        variant === "secondary" && "bg-surface-alt text-ink hover:bg-border",
        variant === "ghost" && "text-ink-muted hover:bg-surface-alt hover:text-ink",
        variant === "danger" && "bg-danger-soft text-danger hover:opacity-80",
        className
      )}
      {...props}
    />
  );
}
