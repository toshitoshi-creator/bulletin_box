import type { ContentItemDTO } from "@/lib/api-types";
import { ContentCard, type CardVariant } from "./ContentCard";
import { CardSkeleton, ListRowSkeleton } from "@/components/ui/States";

export function ContentGrid({ items, variant }: { items: ContentItemDTO[]; variant: CardVariant }) {
  if (variant === "list") {
    return (
      <div className="divide-y divide-border">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} variant="list" />
        ))}
      </div>
    );
  }

  return (
    <div
      className={
        variant === "grid"
          ? "grid grid-cols-3 gap-2 px-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
          : "grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {items.map((item) => (
        <ContentCard key={item.id} item={item} variant={variant} />
      ))}
    </div>
  );
}

export function ContentGridSkeleton({ variant }: { variant: CardVariant }) {
  if (variant === "list") {
    return (
      <div>
        {Array.from({ length: 6 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    );
  }
  return (
    <div
      className={
        variant === "grid"
          ? "grid grid-cols-3 gap-2 px-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6"
          : "grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:grid-cols-3"
      }
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
