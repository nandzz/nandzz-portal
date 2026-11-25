"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Eye, EyeOff, ImageIcon, Minus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { stockBadge, type StockBadge } from "../domain/availability";
import { formatMoney } from "../domain/money";
import { adjustStock, type ProductActionError } from "../actions/products";
import type { ProductView } from "../server/load-products";
import type { ProductStatus } from "../types";
import { fill, useOrdersT } from "./shared";

export function ProductCard({
  product: p,
  currency,
  today,
  locked,
  onOpen,
  onStatus,
  onDelete,
  onError,
}: {
  product: ProductView;
  currency: string;
  today: string;
  locked: boolean;
  onOpen: () => void;
  onStatus: (next: ProductStatus) => void;
  onDelete: () => void;
  onError: (code: ProductActionError) => void;
}) {
  const { t, locale } = useOrdersT();
  const router = useRouter();
  // Optimistic stock count; the DB result (atomic +/-) replaces it.
  const [stock, setStock] = useState(p.stock_qty ?? 0);
  const [syncedFrom, setSyncedFrom] = useState(p.stock_qty);
  if (syncedFrom !== p.stock_qty) {
    setSyncedFrom(p.stock_qty);
    setStock(p.stock_qty ?? 0);
  }
  const [, startTransition] = useTransition();

  const bump = (delta: number) => {
    const before = stock;
    setStock(Math.max(0, before + delta));
    startTransition(async () => {
      const res = await adjustStock(p.id, delta);
      if (res.ok) {
        setStock(res.stockQty);
        router.refresh();
      } else {
        setStock(before);
        onError(res.error);
      }
    });
  };

  const badge = stockBadge({ ...p, stock_qty: p.stock_mode === "stock" ? stock : p.stock_qty }, today);
  const cover = p.images[0];
  const dim = p.status !== "active";

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card transition-[border-color,box-shadow] duration-150 ease-out hover:border-border hover:shadow-sm">
      <button
        type="button"
        onClick={onOpen}
        className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
        aria-label={fill(t.editProductAria, { name: p.name })}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element -- Supabase public URL; sizes vary, cards are small
            <img
              src={cover.url}
              alt=""
              loading="lazy"
              decoding="async"
              className={cn("h-full w-full object-cover", dim && "opacity-60 grayscale-[40%]")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <ImageIcon aria-hidden className="h-7 w-7 text-muted-foreground/50" />
            </div>
          )}
          <Badge badge={badge} />
        </div>
        <div className="min-w-0 px-3 pb-2 pt-2.5">
          <p className="truncate text-sm font-medium">{p.name}</p>
          <p className="truncate text-sm text-muted-foreground tabular-nums">
            {formatMoney(p.price_cents, currency, locale)}
            {p.unit_label ? <span className="text-xs"> / {p.unit_label}</span> : null}
          </p>
        </div>
      </button>

      {p.stock_mode === "stock" && p.status !== "archived" && !locked && (
        <div className="flex items-center justify-between gap-1 border-t border-border/60 px-2 py-1.5">
          <StepButton label={t.stockMinus} onClick={() => bump(-1)} disabled={stock <= 0}>
            <Minus className="h-3.5 w-3.5" />
          </StepButton>
          <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {fill(t.inStockShort, { n: stock })}
          </span>
          <StepButton label={t.stockPlus} onClick={() => bump(1)}>
            <Plus className="h-3.5 w-3.5" />
          </StepButton>
        </div>
      )}

      {!locked && (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={fill(t.productActionsAria, { name: p.name })}
            className="absolute right-1.5 top-1.5 rounded-lg bg-background/85 p-1.5 text-foreground shadow-sm outline-none backdrop-blur transition-[opacity,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100 data-[popup-open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-max">
            <DropdownMenuItem onClick={onOpen} className="gap-2">
              <Pencil className="h-4 w-4" /> {t.edit}
            </DropdownMenuItem>
            {p.status === "draft" && (
              <DropdownMenuItem onClick={() => onStatus("active")} className="gap-2">
                <Eye className="h-4 w-4" /> {t.publish}
              </DropdownMenuItem>
            )}
            {p.status === "active" && (
              <DropdownMenuItem onClick={() => onStatus("draft")} className="gap-2">
                <EyeOff className="h-4 w-4" /> {t.moveToDraft}
              </DropdownMenuItem>
            )}
            {p.status === "archived" ? (
              <DropdownMenuItem onClick={() => onStatus("draft")} className="gap-2">
                <ArchiveRestore className="h-4 w-4" /> {t.restore}
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => onStatus("archived")} className="gap-2">
                <Archive className="h-4 w-4" /> {t.archive}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="gap-2 text-destructive">
              <Trash2 className="h-4 w-4" /> {t.delete}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

function StepButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function Badge({ badge }: { badge: StockBadge }) {
  const { t } = useOrdersT();
  const map: Record<StockBadge["kind"], { text: string; tone: string }> = {
    draft: { text: t.statusDraft, tone: "bg-background/90 text-muted-foreground" },
    archived: { text: t.statusArchived, tone: "bg-background/90 text-muted-foreground" },
    ended: { text: t.badgeEnded, tone: "bg-background/90 text-muted-foreground" },
    sold_out: { text: t.badgeSoldOut, tone: "bg-red-600 text-white" },
    in_stock: { text: badge.kind === "in_stock" ? fill(t.badgeInStock, { n: badge.count }) : "", tone: "bg-background/90 text-foreground" },
    daily: { text: badge.kind === "daily" ? fill(t.badgeDaily, { n: badge.capacity }) : "", tone: "bg-background/90 text-foreground" },
    unlimited: { text: "", tone: "" },
  };
  const { text, tone } = map[badge.kind];
  if (!text) return null;
  return (
    <span className={cn("absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium shadow-sm backdrop-blur tabular-nums", tone)}>
      {text}
    </span>
  );
}
