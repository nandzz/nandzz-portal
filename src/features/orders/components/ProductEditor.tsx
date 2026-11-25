"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ChevronLeft, ChevronRight, ImagePlus, Loader2, Star, X } from "lucide-react";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { currencySymbol } from "@/features/booking/domain/messages";
import { centsToInput, parseMoneyInput } from "../domain/money";
import { addProductImages, removeProductImage, reorderProductImages, saveProduct } from "../actions/products";
import { prepareProductImage, removeUploadedImages, uploadProductImage, type PreparedImage } from "../storage";
import type { ProductView } from "../server/load-products";
import type { ProductStatus, StockMode } from "../types";
import { Field, FieldGroup, errorText, fill, useOrdersT } from "./shared";

const MAX_PHOTOS = 6;

type Photo =
  | { kind: "existing"; id: string; url: string }
  | { kind: "new"; key: string; image: PreparedImage };

const photoKey = (p: Photo) => (p.kind === "existing" ? p.id : p.key);
const photoUrl = (p: Photo) => (p.kind === "existing" ? p.url : p.image.previewUrl);

// "" ⇒ null; otherwise a whole number inside [min, max], else undefined (invalid).
function intField(raw: string, min: number, max: number): number | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n >= min && n <= max ? n : undefined;
}

export function ProductEditor({
  product,
  ownerId,
  currency,
  defaultLeadTimeHours,
  categories,
  readOnly,
  onClose,
}: {
  product: ProductView | null;
  ownerId: string;
  currency: string;
  defaultLeadTimeHours: number;
  categories: string[];
  readOnly: boolean;
  onClose: () => void;
}) {
  const { t, locale } = useOrdersT();
  const router = useRouter();
  const isNew = product === null;
  // Client-generated id: new photos upload under it before the first save.
  const [id] = useState(() => product?.id ?? crypto.randomUUID());
  // Flips once the row exists, so a retry after a failed photo upload updates
  // the product instead of trying to create it a second time.
  const [persisted, setPersisted] = useState(!isNew);

  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [price, setPrice] = useState(product ? centsToInput(product.price_cents) : "");
  const [unit, setUnit] = useState(product?.unit_label ?? "");
  // Archived products stay archived when edited; they're restored from the card menu.
  const [status, setStatus] = useState<ProductStatus>(product?.status ?? "active");
  const [mode, setMode] = useState<StockMode>(product?.stock_mode ?? "unlimited");
  const [stockQty, setStockQty] = useState(product?.stock_qty?.toString() ?? "");
  const [dailyCapacity, setDailyCapacity] = useState(product?.daily_capacity?.toString() ?? "");
  const [minQty, setMinQty] = useState(product?.min_qty?.toString() ?? "1");
  const [maxQty, setMaxQty] = useState(product?.max_qty?.toString() ?? "");
  const [leadTime, setLeadTime] = useState(product?.lead_time_hours?.toString() ?? "");
  const [from, setFrom] = useState(product?.available_from ?? "");
  const [until, setUntil] = useState(product?.available_until ?? "");
  const [weekdays, setWeekdays] = useState<number[]>(product?.fulfilment_weekdays ?? []);

  // `saved` = the photos as stored right now; `photos` = the edited list.
  const [saved, setSaved] = useState<Photo[]>(() =>
    (product?.images ?? []).map((i) => ({ kind: "existing", id: i.id, url: i.url })),
  );
  const [photos, setPhotos] = useState<Photo[]>(saved);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Every preview blob this editor created; freed when it closes.
  const blobs = useRef(new Set<string>());
  useEffect(() => {
    const urls = blobs.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  // Unsaved-changes guard: Escape / backdrop / Cancel ask before dropping edits.
  const snapshot = JSON.stringify([
    name, description, category, price, unit, status, mode, stockQty, dailyCapacity,
    minQty, maxQty, leadTime, from, until, [...weekdays].sort(), photos.map(photoKey),
  ]);
  const [cleanSnapshot, setCleanSnapshot] = useState(snapshot);
  const dirty = !readOnly && snapshot !== cleanSnapshot;
  const requestClose = () => {
    // Escape reaches both dialogs; while the discard question is open, ignore it here.
    if (saving || confirmDiscard) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  // ── validation (mirrors productInputSchema; the DB has the final say) ──
  const priceCents = parseMoneyInput(price);
  const v = {
    name: name.trim().length > 0 && name.trim().length <= 120,
    price: priceCents !== null,
    stock: mode !== "stock" || typeof intField(stockQty, 0, 1_000_000) === "number",
    daily: mode !== "daily" || typeof intField(dailyCapacity, 1, 100_000) === "number",
    min: typeof intField(minQty, 1, 999) === "number",
    max: intField(maxQty, 1, 999) !== undefined && (!maxQty.trim() || Number(maxQty) >= Number(minQty || 1)),
    lead: intField(leadTime, 0, 2160) !== undefined,
    dates: !from || !until || until >= from,
  };
  const valid = Object.values(v).every(Boolean);
  const show = (ok: boolean) => submitted && !ok;

  const weekdayNames = useMemo(() => {
    // 2023-01-01 was a Sunday → index = Postgres dow.
    const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, d) => fmt.format(new Date(Date.UTC(2023, 0, 1 + d))));
  }, [locale]);
  // Show Monday first (Sunday last), the common order in our markets.
  const weekdayOrder = [1, 2, 3, 4, 5, 6, 0];

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setPhotoBusy(true);
    const room = MAX_PHOTOS - photos.length;
    const picked = Array.from(files).slice(0, Math.max(0, room));
    const added: Photo[] = [];
    let failed = false;
    for (const file of picked) {
      const res = await prepareProductImage(file);
      if (typeof res === "string") failed = true;
      else {
        blobs.current.add(res.previewUrl);
        added.push({ kind: "new", key: crypto.randomUUID(), image: res });
      }
    }
    setPhotos((prev) => [...prev, ...added].slice(0, MAX_PHOTOS));
    setPhotoBusy(false);
    if (failed) setError(t.photoUnsupported);
    else if (files.length > room) setError(fill(t.photoMax, { n: MAX_PHOTOS }));
  };

  const move = (index: number, to: number) =>
    setPhotos((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [p] = next.splice(index, 1);
      next.splice(to, 0, p);
      return next;
    });

  const removePhoto = (key: string) => setPhotos((prev) => prev.filter((x) => photoKey(x) !== key));

  const save = async () => {
    setSubmitted(true);
    setError(null);
    if (!valid || priceCents === null || saving) return;
    setSaving(true);
    try {
      const res = await saveProduct({
        id,
        isNew: !persisted,
        keep_stock:
          product?.stock_mode === "stock" && mode === "stock" && stockQty === (product.stock_qty?.toString() ?? ""),
        name,
        description,
        category,
        price_cents: priceCents,
        unit_label: unit,
        status,
        stock_mode: mode,
        stock_qty: intField(stockQty, 0, 1_000_000) ?? null,
        daily_capacity: intField(dailyCapacity, 1, 100_000) ?? null,
        min_qty: intField(minQty, 1, 999) ?? 1,
        max_qty: intField(maxQty, 1, 999) ?? null,
        lead_time_hours: intField(leadTime, 0, 2160) ?? null,
        available_from: from || null,
        available_until: until || null,
        fulfilment_weekdays: weekdays.length ? weekdays : null,
      });
      if (!res.ok) {
        setError(errorText(t, res.error));
        return;
      }
      setPersisted(true);

      // Photos: removals, then uploads (browser → Storage), then rows, then
      // order. `stored` tracks what is really saved, so a retry after a failure
      // only redoes the missing steps.
      const keep = new Set(photos.filter((p) => p.kind === "existing").map(photoKey));
      let stored = saved;
      let removeFailed = false;
      for (const p of saved) {
        if (keep.has(photoKey(p))) continue;
        const removed = await removeProductImage(photoKey(p));
        if (removed.ok || removed.error === "NOT_FOUND") stored = stored.filter((x) => photoKey(x) !== photoKey(p));
        else removeFailed = true;
      }
      setSaved(stored);
      if (removeFailed) {
        setError(t.errFailed);
        router.refresh();
        return;
      }

      const fresh = photos.filter((p): p is Extract<Photo, { kind: "new" }> => p.kind === "new");
      const newIds = new Map<string, string>();
      if (fresh.length) {
        const paths: string[] = [];
        for (const p of fresh) {
          const path = await uploadProductImage(ownerId, id, p.image);
          if (!path) {
            await removeUploadedImages(paths);
            setError(t.photoUploadFailed);
            router.refresh();
            return;
          }
          paths.push(path);
        }
        const added = await addProductImages(
          id,
          fresh.map((p, i) => ({ path: paths[i], width: p.image.width, height: p.image.height })),
        );
        if (!added.ok) {
          setError(errorText(t, added.error));
          router.refresh();
          return;
        }
        fresh.forEach((p, i) => newIds.set(p.key, added.ids[i]));
        // Registered photos become "existing" so a later retry won't upload them again.
        const asExisting = (p: Photo): Photo =>
          p.kind === "new" && newIds.has(p.key) ? { kind: "existing", id: newIds.get(p.key)!, url: p.image.previewUrl } : p;
        setPhotos((prev) => prev.map(asExisting));
        stored = [...stored, ...fresh.map(asExisting)];
        setSaved(stored);
      }

      const finalIds = photos.map((p) => (p.kind === "existing" ? p.id : newIds.get(p.key))).filter((x): x is string => !!x);
      const storedIds = stored.map(photoKey);
      const sameOrder = finalIds.length === storedIds.length && finalIds.every((x, i) => x === storedIds[i]);
      if (finalIds.length > 1 && !sameOrder) await reorderProductImages(id, finalIds);

      setCleanSnapshot(snapshot);
      router.refresh();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const modeOptions: { value: StockMode; label: string; hint: string }[] = [
    { value: "unlimited", label: t.modeUnlimited, hint: t.modeUnlimitedHint },
    { value: "stock", label: t.modeStock, hint: t.modeStockHint },
    { value: "daily", label: t.modeDaily, hint: t.modeDailyHint },
  ];

  return (
    <ResponsivePanel
      open
      onClose={requestClose}
      title={isNew ? t.newProduct : t.editProduct}
      maxWidthClass="max-w-2xl"
      bodyClassName="-mx-6 max-h-[65vh] px-6 pb-1"
      footer={
        <div className="space-y-3">
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {submitted && !valid && !error && <p className="text-sm text-destructive">{t.fixFields}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={requestClose} disabled={saving}>
              {readOnly ? t.close : t.cancel}
            </Button>
            {!readOnly && (
              <Button onClick={save} disabled={saving || photoBusy} className="max-sm:flex-1">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {isNew ? t.createProduct : t.save}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <fieldset disabled={readOnly || saving} className="min-w-0 space-y-6">
        {/* Photos */}
        <FieldGroup
          label={t.photos}
          aside={
            <span className="text-xs text-muted-foreground tabular-nums">
              {photos.length}/{MAX_PHOTOS}
            </span>
          }
          hint={t.photosHint}
        >
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {photos.map((p, i) => (
              <div key={photoKey(p)} className="group relative aspect-square overflow-hidden rounded-lg border border-border/60 bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: previews and Supabase public URLs */}
                <img src={photoUrl(p)} alt="" className="h-full w-full object-cover" />
                {i === 0 && (
                  <span className="absolute left-1 top-1 flex items-center gap-0.5 rounded bg-background/90 px-1 py-0.5 text-[10px] font-medium">
                    <Star aria-hidden className="h-2.5 w-2.5" /> {t.cover}
                  </span>
                )}
                {!readOnly && (
                  <>
                    <button
                      type="button"
                      onClick={() => removePhoto(photoKey(p))}
                      aria-label={t.removePhoto}
                      className="absolute right-1 top-1 rounded-full bg-background/90 p-0.5 shadow-sm outline-none transition-transform duration-150 ease-out active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <div className="absolute inset-x-1 bottom-1 flex justify-between">
                      <PhotoArrow label={t.movePhotoLeft} onClick={() => move(i, i - 1)} hidden={i === 0}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </PhotoArrow>
                      <PhotoArrow label={t.movePhotoRight} onClick={() => move(i, i + 1)} hidden={i === photos.length - 1}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </PhotoArrow>
                    </div>
                  </>
                )}
              </div>
            ))}
            {!readOnly && photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={photoBusy}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-border text-xs text-muted-foreground outline-none transition-[background-color,color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                {photoBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                {t.addPhoto}
              </button>
            )}
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            className="hidden"
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </FieldGroup>

        {/* Details */}
        <section className="space-y-4">
          <Field label={t.name} error={show(v.name) ? t.nameRequired : null}>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder={t.namePlaceholder} aria-invalid={show(v.name)} />
          </Field>
          <Field label={t.description} hint={t.descriptionHint}>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3} />
          </Field>
          {/* Phone: price + unit side by side, category below. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t.price} error={show(v.price) ? t.priceInvalid : null}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencySymbol(currency)}
                </span>
                <Input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="0.00"
                  className="pl-8 tabular-nums"
                  aria-invalid={show(v.price)}
                />
              </div>
            </Field>
            <Field label={t.unit} optional>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={30} placeholder={t.unitPlaceholder} />
            </Field>
            <Field label={t.category} className="col-span-2 sm:col-span-1">
              <Input value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} list="orders-product-categories" placeholder={t.categoryPlaceholder} />
              <datalist id="orders-product-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
          </div>
        </section>

        {/* Availability */}
        {/* Groups 20px apart, label → controls 8px: each block reads as one unit. */}
        <section className="space-y-5">
          <FieldGroup label={t.availability}>
          <div role="radiogroup" aria-label={t.availability} className="grid gap-2 sm:grid-cols-3">
            {modeOptions.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={mode === o.value}
                onClick={() => setMode(o.value)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left outline-none transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50",
                  mode === o.value ? "border-foreground bg-muted/60" : "border-border hover:bg-muted/40",
                )}
              >
                <span className="block text-sm font-medium">{o.label}</span>
                <span className="block text-xs text-muted-foreground">{o.hint}</span>
              </button>
            ))}
          </div>
          {mode === "stock" && (
            <Field label={t.stockQty} error={show(v.stock) ? t.numberInvalid : null} className="sm:max-w-48">
              <Input value={stockQty} onChange={(e) => setStockQty(e.target.value)} inputMode="numeric" aria-invalid={show(v.stock)} />
            </Field>
          )}
          {mode === "daily" && (
            <Field label={t.dailyCapacity} hint={t.dailyCapacityHint} error={show(v.daily) ? t.numberInvalid : null} className="sm:max-w-64">
              <Input value={dailyCapacity} onChange={(e) => setDailyCapacity(e.target.value)} inputMode="numeric" aria-invalid={show(v.daily)} />
            </Field>
          )}
          </FieldGroup>

          {/* Phone: min + max side by side, preparation time below. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label={t.minQty} error={show(v.min) ? t.numberInvalid : null}>
              <Input value={minQty} onChange={(e) => setMinQty(e.target.value)} inputMode="numeric" aria-invalid={show(v.min)} />
            </Field>
            <Field label={t.maxQty} optional error={show(v.max) ? t.maxQtyInvalid : null}>
              <Input value={maxQty} onChange={(e) => setMaxQty(e.target.value)} inputMode="numeric" aria-invalid={show(v.max)} />
            </Field>
            <Field label={t.leadTime} hint={fill(t.leadTimeHint, { n: defaultLeadTimeHours })} error={show(v.lead) ? t.numberInvalid : null} className="col-span-2 sm:col-span-1">
              <Input
                value={leadTime}
                onChange={(e) => setLeadTime(e.target.value)}
                inputMode="numeric"
                placeholder={String(defaultLeadTimeHours)}
                aria-invalid={show(v.lead)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.availableFrom} optional>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t.availableUntil} optional error={show(v.dates) ? t.datesInvalid : null}>
              <Input type="date" value={until} min={from || undefined} onChange={(e) => setUntil(e.target.value)} aria-invalid={show(v.dates)} />
            </Field>
          </div>

          <FieldGroup label={t.weekdays} hint={weekdays.length ? t.weekdaysSome : t.weekdaysAll}>
            {/* Phone: all seven days on one row. */}
            <div className="grid grid-cols-7 gap-1.5 sm:flex sm:flex-wrap">
              {weekdayOrder.map((d) => {
                const on = weekdays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekdays((prev) => (on ? prev.filter((x) => x !== d) : [...prev, d]))}
                    className={cn(
                      "h-9 min-w-0 rounded-full border px-0 text-xs font-medium capitalize sm:h-8 sm:min-w-11 sm:px-2.5 outline-none transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50",
                      on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {weekdayNames[d]}
                  </button>
                );
              })}
            </div>
          </FieldGroup>
        </section>

        {/* Visibility */}
        {status === "archived" ? (
          <section className="flex items-start gap-3 rounded-lg border border-border/60 px-4 py-3">
            <Archive aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{t.archivedNote}</p>
          </section>
        ) : (
          <section className="flex items-start justify-between gap-4 rounded-lg border border-border/60 px-4 py-3">
            <div>
              <p className="text-sm font-medium">{t.visibleToAgent}</p>
              <p className="text-xs text-muted-foreground">{status === "active" ? t.visibleOnHint : t.visibleOffHint}</p>
            </div>
            <Switch
              checked={status === "active"}
              onCheckedChange={(on) => setStatus(on ? "active" : "draft")}
              aria-label={t.visibleToAgent}
            />
          </section>
        )}
      </fieldset>


      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={onClose}
        title={t.discardTitle}
        description={t.discardBody}
        confirmLabel={t.discard}
        cancelLabel={t.keepEditing}
      />
    </ResponsivePanel>
  );
}

function PhotoArrow({
  label,
  onClick,
  hidden,
  children,
}: {
  label: string;
  onClick: () => void;
  hidden: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-full bg-background/90 p-0.5 shadow-sm outline-none transition-transform duration-150 ease-out active:scale-[0.94] focus-visible:ring-2 focus-visible:ring-ring/50",
        hidden && "invisible",
      )}
    >
      {children}
    </button>
  );
}
