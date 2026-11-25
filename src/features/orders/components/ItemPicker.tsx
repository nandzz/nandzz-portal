"use client";

import { useMemo, useState } from "react";
import { ImageIcon, Minus, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatMoney } from "../domain/money";
import type { ProductView } from "../server/load-products";
import { fill, useOrdersT } from "./shared";

export type PickedLine = { productId: string; quantity: number; note: string };

const MAX_LINES = 30;
const MAX_QTY = 999;

// Product picker for owner-made orders. Search scopes one bounded list (no
// growth with the catalogue); picked lines sit above it with a stepper and a
// per-line note ("write Happy birthday Ana"). Archived products never show;
// drafts do (the owner may sell something not offered to customers).
export function ItemPicker({
  products,
  lines,
  onChange,
  currency,
  disabled,
}: {
  products: ProductView[];
  lines: PickedLine[];
  onChange: (next: PickedLine[]) => void;
  currency: string;
  disabled?: boolean;
}) {
  const { t, locale } = useOrdersT();
  const [query, setQuery] = useState("");
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const sellable = useMemo(() => products.filter((p) => p.status !== "archived"), [products]);
  const picked = new Set(lines.map((l) => l.productId));

  const results = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return sellable.filter((p) => !q || p.name.toLocaleLowerCase().includes(q) || (p.category ?? "").toLocaleLowerCase().includes(q));
  }, [sellable, query]);

  const setQty = (productId: string, quantity: number) =>
    onChange(
      quantity <= 0
        ? lines.filter((l) => l.productId !== productId)
        : lines.map((l) => (l.productId === productId ? { ...l, quantity: Math.min(MAX_QTY, quantity) } : l)),
    );
  const add = (productId: string) => {
    if (picked.has(productId)) return setQty(productId, (lines.find((l) => l.productId === productId)?.quantity ?? 0) + 1);
    if (lines.length >= MAX_LINES) return;
    onChange([...lines, { productId, quantity: Math.max(1, byId.get(productId)?.min_qty ?? 1), note: "" }]);
  };

  const subtotal = lines.reduce((sum, l) => sum + (byId.get(l.productId)?.price_cents ?? 0) * l.quantity, 0);

  return (
    <div className="space-y-3">
      {lines.length > 0 && (
        <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
          {lines.map((l) => {
            const p = byId.get(l.productId);
            return (
              <li key={l.productId} className="space-y-2 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p?.name ?? t.unknownProduct}</span>
                  <Stepper
                    value={l.quantity}
                    disabled={disabled}
                    onChange={(q) => setQty(l.productId, q)}
                    label={t.quantity}
                    minusLabel={t.qtyMinus}
                    plusLabel={t.qtyPlus}
                  />
                  <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                    {formatMoney((p?.price_cents ?? 0) * l.quantity, currency, locale)}
                  </span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setQty(l.productId, 0)}
                    aria-label={fill(t.removeLineAria, { name: p?.name ?? "" })}
                    className="rounded-md p-1 text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Input
                  value={l.note}
                  disabled={disabled}
                  maxLength={300}
                  onChange={(e) => onChange(lines.map((x) => (x.productId === l.productId ? { ...x, note: e.target.value } : x)))}
                  placeholder={t.lineNotePlaceholder}
                  className="h-8 md:text-xs"
                />
              </li>
            );
          })}
          <li className="flex justify-between px-3 py-2 text-sm font-medium">
            <span>{t.subtotal}</span>
            <span className="tabular-nums">{formatMoney(subtotal, currency, locale)}</span>
          </li>
        </ul>
      )}

      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          disabled={disabled}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.searchProducts}
          aria-label={t.searchProducts}
          className="h-9 pl-9"
        />
      </div>
      {sellable.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">{t.pickerNoProducts}</p>
      ) : results.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">{t.noProductsMatch}</p>
      ) : (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {results.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => add(p.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-ring/50",
                  picked.has(p.id) && "bg-muted/60",
                )}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted">
                  {p.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- small Supabase thumbnails
                    <img src={p.images[0].url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <ImageIcon aria-hidden className="h-4 w-4 text-muted-foreground/60" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.status === "draft" ? `${t.statusDraft} · ` : ""}
                    {p.stock_mode === "stock" ? fill(t.inStockShort, { n: p.stock_qty ?? 0 }) : p.unit_label ?? ""}
                  </span>
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{formatMoney(p.price_cents, currency, locale)}</span>
                <Plus aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  disabled,
  label,
  minusLabel,
  plusLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  label: string;
  minusLabel: string;
  plusLabel: string;
}) {
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40";
  return (
    <span className="flex items-center">
      <button type="button" className={btn} aria-label={minusLabel} disabled={disabled} onClick={() => onChange(value - 1)}>
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        value={value}
        disabled={disabled}
        inputMode="numeric"
        aria-label={label}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (Number.isFinite(n) && n >= 1) onChange(Math.min(MAX_QTY, n));
        }}
        className="h-7 w-10 rounded-md bg-transparent text-center text-base tabular-nums md:text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      />
      <button type="button" className={btn} aria-label={plusLabel} disabled={disabled || value >= MAX_QTY} onClick={() => onChange(value + 1)}>
        <Plus className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}
