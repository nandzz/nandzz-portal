"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Package, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { localNow } from "../domain/availability";
import { deleteProduct, setProductStatus } from "../actions/products";
import type { ProductsData, ProductView } from "../server/load-products";
import type { ProductStatus } from "../types";
import { ProductCard } from "./ProductCard";
import { ProductEditor } from "./ProductEditor";
import { EmptyState, FilterPill, errorText, fill, useOrdersT, type OrdersT } from "./shared";

type StatusFilter = "live" | "active" | "draft" | "archived";
const OTHER = "\u0000other"; // category filter key for products without a category

// One bounded surface for any catalogue size: a search box plus status and
// category pills scope ONE grid; the editor opens in a dialog. No per-category
// sections, so 5 or 500 products read the same.
export function ProductsTab({ data, ownerId, now }: { data: ProductsData; ownerId: string; now: number }) {
  const { t } = useOrdersT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("live");
  const [category, setCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<ProductView | "new" | null>(null);
  const [deleting, setDeleting] = useState<ProductView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const today = localNow(data.timezone, new Date(now)).date;
  const blocked = data.status.manual_blocked;
  const locked = blocked === "not_entitled" || blocked === "suspended" || blocked === "orders_disabled";
  const { products } = data;

  const counts = useMemo(
    () => ({
      live: products.filter((p) => p.status !== "archived").length,
      active: products.filter((p) => p.status === "active").length,
      draft: products.filter((p) => p.status === "draft").length,
      archived: products.filter((p) => p.status === "archived").length,
    }),
    [products],
  );

  const inStatus = useMemo(
    () => products.filter((p) => (status === "live" ? p.status !== "archived" : p.status === status)),
    [products, status],
  );

  const categories = useMemo(() => {
    const names = new Map<string, number>();
    let other = 0;
    for (const p of inStatus) {
      if (p.category) names.set(p.category, (names.get(p.category) ?? 0) + 1);
      else other++;
    }
    return { list: [...names.entries()].sort(([a], [b]) => a.localeCompare(b)), other };
  }, [inStatus]);

  // A category pill disappears when its last product leaves the status scope.
  const activeCategory =
    category === OTHER ? (categories.other > 0 ? OTHER : null) : categories.list.some(([c]) => c === category) ? category : null;

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return inStatus.filter((p) => {
      if (activeCategory === OTHER ? p.category : activeCategory && p.category !== activeCategory) return false;
      if (!q) return true;
      return p.name.toLocaleLowerCase().includes(q) || (p.description ?? "").toLocaleLowerCase().includes(q);
    });
  }, [inStatus, activeCategory, query]);

  const allCategories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const changeStatus = async (p: ProductView, next: ProductStatus) => {
    setError(null);
    const res = await setProductStatus(p.id, next);
    if (!res.ok) setError(errorText(t, res.error));
    else router.refresh();
  };

  const limitReached = data.status.product_limit !== null && counts.live >= data.status.product_limit;

  // `compact`: icon-only on phones, next to the search field.
  const newButton = (compact = false) => (
    <Button
      onClick={() => setEditing("new")}
      disabled={locked || limitReached}
      aria-label={compact ? t.newProduct : undefined}
      className={cn(compact && "max-sm:w-9 max-sm:px-0")}
    >
      <Plus className="h-4 w-4" /> <span className={cn(compact && "max-sm:sr-only")}>{t.newProduct}</span>
    </Button>
  );

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-amber-950/30">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-400" />
          <p className="text-amber-900 dark:text-amber-200">{blockedText(t, blocked)}</p>
        </div>
      )}
      {limitReached && !locked && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {fill(t.productLimitReached, { limit: data.status.product_limit ?? 0 })}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {products.length === 0 ? (
        <EmptyState icon={Package} title={t.productsEmptyTitle} body={t.productsEmptyBody} action={newButton()} />
      ) : (
        <>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.searchProducts}
                aria-label={t.searchProducts}
                className="h-9 pl-9"
              />
            </div>
            {newButton(true)}
          </div>

          {/* Status scope, then categories inside it. Rows scroll sideways, no scrollbar. */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            <FilterPill active={status === "live"} onClick={() => setStatus("live")} count={counts.live}>
              {t.filterAll}
            </FilterPill>
            <FilterPill active={status === "active"} onClick={() => setStatus("active")} count={counts.active}>
              {t.statusActive}
            </FilterPill>
            <FilterPill active={status === "draft"} onClick={() => setStatus("draft")} count={counts.draft}>
              {t.statusDraft}
            </FilterPill>
            {counts.archived > 0 && (
              <FilterPill active={status === "archived"} onClick={() => setStatus("archived")} count={counts.archived}>
                {t.statusArchived}
              </FilterPill>
            )}
          </div>
          {(categories.list.length > 1 || (categories.list.length > 0 && categories.other > 0)) && (
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
              <FilterPill active={activeCategory === null} onClick={() => setCategory(null)}>
                {t.allCategories}
              </FilterPill>
              {categories.list.map(([name, n]) => (
                <FilterPill key={name} active={activeCategory === name} onClick={() => setCategory(name)} count={n}>
                  {name}
                </FilterPill>
              ))}
              {categories.other > 0 && (
                <FilterPill active={activeCategory === OTHER} onClick={() => setCategory(OTHER)} count={categories.other}>
                  {t.otherProducts}
                </FilterPill>
              )}
            </div>
          )}

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
              {t.noProductsMatch}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  currency={data.currency}
                  today={today}
                  locked={locked}
                  onOpen={() => setEditing(p)}
                  onStatus={(next) => changeStatus(p, next)}
                  onDelete={() => setDeleting(p)}
                  onError={(e) => setError(errorText(t, e))}
                />
              ))}
            </div>
          )}
        </>
      )}

      {editing && (
        <ProductEditor
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          ownerId={ownerId}
          currency={data.currency}
          defaultLeadTimeHours={data.defaultLeadTimeHours}
          categories={allCategories}
          readOnly={locked}
          onClose={() => setEditing(null)}
        />
      )}

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          const res = await deleteProduct(deleting.id);
          if (!res.ok) setError(errorText(t, res.error));
          else router.refresh();
        }}
        title={fill(t.deleteTitle, { name: deleting?.name ?? "" })}
        description={t.deleteBody}
        confirmLabel={t.delete}
        cancelLabel={t.cancel}
      />
    </div>
  );
}

function blockedText(t: OrdersT, reason: string | null): string {
  if (reason === "suspended") return t.blockedSuspended;
  if (reason === "orders_disabled") return t.blockedDisabled;
  return t.blockedNotEntitled;
}
