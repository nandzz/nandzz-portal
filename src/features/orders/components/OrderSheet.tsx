"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MapPin, MessageCircle, Pencil, Phone, Mail, Store, Truck } from "lucide-react";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { dialForRegion } from "@/features/booking/domain/phone";
import { formatMoney } from "../domain/money";
import { canEditItems, isClosed } from "../domain/status";
import { actionTarget, stepActions, timeWindow, type OrderView, type StepAction } from "../domain/orders-view";
import { loadOrderEvents, replaceOrderItems, setOrderStatus, updateOrder, type OrderActionResult } from "../actions/orders";
import type { ProductView } from "../server/load-products";
import type { OrderEvent, OrderStatus, OwnerPaymentMethod } from "../types";
import { ItemPicker, type PickedLine } from "./ItemPicker";
import {
  CustomerFields,
  FulfilmentFields,
  addressFromDraft,
  customerDraft,
  draftFromAddress,
  phoneFromDraft,
  validateDrafts,
  type CustomerDraft,
  type FulfilmentDraft,
} from "./OrderFields";
import { StatusBadge, statusLabel } from "./StatusBadge";
import { orderErrorText } from "./orderErrors";
import { fill, useOrdersT, type OrdersT } from "./shared";

type Mode = "view" | "edit_details" | "edit_items";

export function OrderSheet({
  order: o,
  products,
  pickupAddress,
  defaultPhoneRegion,
  onClose,
}: {
  order: OrderView;
  products: ProductView[];
  pickupAddress: string | null;
  defaultPhoneRegion: string;
  onClose: () => void;
}) {
  const { t, locale } = useOrdersT();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("view");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<"reject" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [internal, setInternal] = useState(o.internal_note ?? "");
  const [events, setEvents] = useState<OrderEvent[] | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);

  // An open editor or an unsaved internal note would be lost silently on close.
  const dirty = mode !== "view" || internal !== (o.internal_note ?? "");
  const requestClose = () => {
    if (busy || confirmClose) return;
    if (dirty) setConfirmClose(true);
    else onClose();
  };
  const ask = (what: "reject" | "cancel") => {
    setReason("");
    setAsking(what);
  };

  const closed = isClosed(o.status);
  const actions = stepActions(o.status, o.fulfilment_method);
  const main = actions.filter((a) => a !== "cancel" && a !== "reject");
  const dateTime = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }), [locale]);
  const dayFmt = useMemo(
    () => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }),
    [locale],
  );

  // History reloads whenever the order changes (status, edits, payment).
  useEffect(() => {
    let alive = true;
    void loadOrderEvents(o.id).then((res) => {
      if (alive && res.ok) setEvents(res.events);
    });
    return () => {
      alive = false;
    };
  }, [o.id, o.updated_at]);

  const run = async (fn: () => Promise<OrderActionResult>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) {
      setError(orderErrorText(t, res.error, res.detail, products));
      router.refresh();
      return;
    }
    after?.();
    router.refresh();
  };

  const step = (a: StepAction, why?: string) => run(() => setOrderStatus(o.id, actionTarget(a), why), () => setAsking(null));

  // wa.me needs the country code. Phones are E.164; older ones saved without
  // "+" get the business's default dial code.
  const rawPhone = (o.customer_phone ?? "").trim();
  const localDigits = rawPhone.replace(/\D/g, "");
  const phoneDigits = rawPhone.startsWith("+") || rawPhone.startsWith("00")
    ? localDigits.replace(/^00/, "")
    : localDigits && dialForRegion(defaultPhoneRegion) + localDigits;
  const fullAddress = o.delivery_address
    ? [o.delivery_address.line1, o.delivery_address.line2, o.delivery_address.postal_code, o.delivery_address.city].filter(Boolean).join(", ")
    : null;
  const time = timeWindow(o.fulfil_from, o.fulfil_to);
  // Where the handover happens: the customer's address, or the shop's for pickups.
  const handoverAddress = o.fulfilment_method === "delivery" ? fullAddress : pickupAddress;
  const items = [...o.items].sort((a, b) => a.position - b.position);

  return (
    <ResponsivePanel
      open
      onClose={requestClose}
      title={fill(t.orderTitle, { n: o.order_number })}
      maxWidthClass="max-w-2xl"
      bodyClassName="-mx-6 max-h-[72vh] px-6 pb-1"
    >
      <div className="min-w-0 space-y-5">
        {/* Status + next steps */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={o.status} />
            <span className="text-muted-foreground">
              {o.source === "agent" ? t.sourceAgent : t.sourceManual} · {dateTime.format(new Date(o.created_at))}
            </span>
          </div>
          {o.status === "pending" && o.expires_at && (
            <p className="text-xs text-muted-foreground">{fill(t.expiresAt, { time: dateTime.format(new Date(o.expires_at)) })}</p>
          )}
          {o.cancel_reason && (o.status === "cancelled" || o.status === "rejected") && (
            <p className="text-sm text-muted-foreground">{fill(t.reasonLine, { reason: o.cancel_reason })}</p>
          )}
          {!closed && mode === "view" && (
            <div className="flex flex-wrap gap-2">
              {main.map((a, i) => (
                <Button key={a} variant={i === 0 ? "default" : "outline"} disabled={busy} onClick={() => step(a)}>
                  {actionLabel(t, a)}
                </Button>
              ))}
              {actions.includes("reject") && (
                <Button variant="outline" disabled={busy} onClick={() => ask("reject")}>
                  {t.actReject}
                </Button>
              )}
              {actions.includes("cancel") && (
                <Button variant="ghost" className="text-destructive" disabled={busy} onClick={() => ask("cancel")}>
                  {t.actCancel}
                </Button>
              )}
              {busy && <Loader2 aria-hidden className="h-4 w-4 animate-spin self-center text-muted-foreground" />}
            </div>
          )}
          {asking && (
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-sm font-medium">{asking === "reject" ? t.rejectQuestion : t.cancelQuestion}</p>
              <Input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setAsking(null)} disabled={busy}>
                  {t.back}
                </Button>
                <Button variant="destructive" size="sm" disabled={busy} onClick={() => step(asking, reason)}>
                  {asking === "reject" ? t.actReject : t.actCancel}
                </Button>
              </div>
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        {/* Items */}
        <Block
          title={t.items}
          action={!closed && canEditItems(o.status) && mode === "view" ? { label: t.edit, onClick: () => setMode("edit_items") } : undefined}
        >
          {mode === "edit_items" ? (
            <ItemsEditor order={o} products={products} busy={busy} onCancel={() => setMode("view")} onSave={(lines) =>
              run(
                () => replaceOrderItems(o.id, lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, note: l.note.trim() || null }))),
                () => setMode("view"),
              )
            } />
          ) : (
            <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
              {items.map((i) => (
                <li key={i.id} className="flex gap-3 px-3 py-2 text-sm">
                  <span className="w-8 shrink-0 tabular-nums text-muted-foreground">{i.quantity}×</span>
                  <span className="min-w-0 flex-1">
                    <span className="block">{i.name}</span>
                    {i.note && <span className="block text-xs text-muted-foreground">“{i.note}”</span>}
                  </span>
                  <span className="shrink-0 tabular-nums">{formatMoney(i.line_total_cents, o.currency, locale)}</span>
                </li>
              ))}
              <Total label={t.subtotal} cents={o.subtotal_cents} currency={o.currency} />
              {o.fulfilment_method === "delivery" && <Total label={t.deliveryFee} cents={o.delivery_fee_cents} currency={o.currency} />}
              <Total label={t.total} cents={o.total_cents} currency={o.currency} strong />
            </ul>
          )}
        </Block>

        {/* Customer + fulfilment */}
        <Block
          title={t.customerAndFulfilment}
          action={!closed && mode === "view" ? { label: t.edit, onClick: () => setMode("edit_details") } : undefined}
        >
          {mode === "edit_details" ? (
            <DetailsEditor order={o} busy={busy} pickupAddress={pickupAddress} defaultPhoneRegion={defaultPhoneRegion} onCancel={() => setMode("view")} onSave={(patch) =>
              run(() => updateOrder(o.id, patch), () => setMode("view"))
            } />
          ) : (
            <div className="space-y-3">
              {/* Two cards: who (with one-tap contact) and the handover. Stacked on phones. */}
              <div className="grid gap-px overflow-hidden rounded-lg border border-border/60 bg-border/60 sm:grid-cols-2">
                <div className="min-w-0 space-y-2.5 bg-background p-3">
                  <p className="text-xs font-medium text-muted-foreground">{t.customer}</p>
                  <div className="min-w-0 text-sm">
                    <p className="truncate font-medium">{o.customer_name}</p>
                    {o.customer_phone && <p className="tabular-nums text-muted-foreground">{o.customer_phone}</p>}
                    {o.customer_email && <p className="truncate text-muted-foreground">{o.customer_email}</p>}
                  </div>
                  {(o.customer_phone || o.customer_email) && (
                    <div className="flex flex-wrap gap-1.5">
                      {o.customer_phone && (
                        <ContactLink href={`tel:${o.customer_phone.replace(/[^\d+]/g, "")}`} icon={Phone} label={t.callAction} />
                      )}
                      {o.customer_phone && phoneDigits.length >= 6 && (
                        <ContactLink href={`https://wa.me/${phoneDigits}`} icon={MessageCircle} label="WhatsApp" external />
                      )}
                      {o.customer_email && <ContactLink href={`mailto:${o.customer_email}`} icon={Mail} label={t.emailAction} />}
                    </div>
                  )}
                </div>
                <div className="min-w-0 space-y-2.5 bg-background p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    {o.fulfilment_method === "delivery" ? <Truck aria-hidden className="h-3.5 w-3.5" /> : <Store aria-hidden className="h-3.5 w-3.5" />}
                    {o.fulfilment_method === "delivery" ? t.delivery : t.pickup}
                  </p>
                  <div className="text-sm">
                    <p className="font-medium first-letter:uppercase">{dayFmt.format(new Date(`${o.fulfil_on}T00:00:00Z`))}</p>
                    <p className="tabular-nums text-muted-foreground">{time ?? t.anyTime}</p>
                  </div>
                  {handoverAddress && (
                    <a
                      className="flex items-start gap-1.5 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(handoverAddress)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MapPin aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0">
                        {handoverAddress}
                        {o.fulfilment_method === "delivery" && o.delivery_address?.notes && (
                          <span className="block text-xs">{o.delivery_address.notes}</span>
                        )}
                      </span>
                    </a>
                  )}
                </div>
              </div>
              {o.customer_note && <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm">“{o.customer_note}”</p>}
            </div>
          )}
        </Block>

        {/* Payment */}
        <Block title={t.payment}>
          <PaymentPanel order={o} busy={busy} onSet={(patch) => run(() => updateOrder(o.id, patch))} />
        </Block>

        {/* Internal note */}
        <Block title={t.internalNote}>
          <Textarea value={internal} onChange={(e) => setInternal(e.target.value)} maxLength={2000} rows={2} placeholder={t.internalNotePlaceholder} />
          {internal !== (o.internal_note ?? "") && (
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => updateOrder(o.id, { internal_note: internal.trim() || null }))}>
                {t.saveNote}
              </Button>
            </div>
          )}
        </Block>

        {/* History */}
        <Block title={t.history}>
          <HistoryTimeline events={events} />
        </Block>
      </div>

      <ConfirmDialog
        open={confirmClose}
        onClose={() => setConfirmClose(false)}
        onConfirm={onClose}
        title={t.discardTitle}
        description={t.discardSheetBody}
        confirmLabel={t.discard}
        cancelLabel={t.keepEditing}
      />
    </ResponsivePanel>
  );
}

function Block({ title, action, children }: { title: string; action?: { label: string; onClick: () => void }; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <Pencil aria-hidden className="h-3 w-3" /> {action.label}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function Total({ label, cents, currency, strong }: { label: string; cents: number; currency: string; strong?: boolean }) {
  const { locale } = useOrdersT();
  return (
    <li className={cn("flex justify-between px-3 py-1.5 text-sm", strong ? "font-semibold" : "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular-nums">{formatMoney(cents, currency, locale)}</span>
    </li>
  );
}

function ItemsEditor({
  order,
  products,
  busy,
  onCancel,
  onSave,
}: {
  order: OrderView;
  products: ProductView[];
  busy: boolean;
  onCancel: () => void;
  onSave: (lines: PickedLine[]) => void;
}) {
  const { t } = useOrdersT();
  // Lines whose product was deleted or archived can't be re-priced (the DB
  // refuses archived products), so they can't be kept.
  const keepable = (i: OrderView["items"][number]) =>
    !!i.product_id && products.some((p) => p.id === i.product_id && p.status !== "archived");
  const [lines, setLines] = useState<PickedLine[]>(() =>
    [...order.items]
      .sort((a, b) => a.position - b.position)
      .filter(keepable)
      .map((i) => ({ productId: i.product_id as string, quantity: i.quantity, note: i.note ?? "" })),
  );
  const lost = order.items.some((i) => !keepable(i));
  return (
    <div className="space-y-3">
      {lost && <p className="text-xs text-amber-700 dark:text-amber-400">{t.itemsLostNote}</p>}
      <p className="text-xs text-muted-foreground">{t.itemsRepriceNote}</p>
      <ItemPicker products={products} lines={lines} onChange={setLines} currency={order.currency} disabled={busy} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </Button>
        <Button size="sm" onClick={() => onSave(lines)} disabled={busy || lines.length === 0}>
          {t.saveItems}
        </Button>
      </div>
    </div>
  );
}

function DetailsEditor({
  order,
  busy,
  pickupAddress,
  defaultPhoneRegion,
  onCancel,
  onSave,
}: {
  order: OrderView;
  busy: boolean;
  pickupAddress: string | null;
  defaultPhoneRegion: string;
  onCancel: () => void;
  onSave: (patch: Parameters<typeof updateOrder>[1]) => void;
}) {
  const { t } = useOrdersT();
  const [customer, setCustomer] = useState<CustomerDraft>(() => customerDraft(order, defaultPhoneRegion));
  const [f, setF] = useState<FulfilmentDraft>({
    method: order.fulfilment_method,
    date: order.fulfil_on,
    from: order.fulfil_from?.slice(0, 5) ?? "",
    to: order.fulfil_to?.slice(0, 5) ?? "",
    address: draftFromAddress(order.delivery_address),
  });
  const [submitted, setSubmitted] = useState(false);
  const errors = validateDrafts(customer, f);
  const shown = submitted ? errors : { name: false, email: false, phone: false, date: false, time: false, address: false };
  const save = () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({
      customer_name: customer.name.trim(),
      customer_phone: phoneFromDraft(customer),
      customer_email: customer.email.trim() || null,
      fulfilment_method: f.method,
      fulfil_on: f.date,
      fulfil_from: f.from || null,
      fulfil_to: f.to || null,
      delivery_address: f.method === "delivery" ? addressFromDraft(f.address) : null,
    });
  };
  return (
    <fieldset disabled={busy} className="min-w-0 space-y-3">
      <CustomerFields value={customer} onChange={setCustomer} errors={shown} />
      <FulfilmentFields value={f} onChange={setF} errors={shown} pickupAddress={pickupAddress} />
      {f.method !== order.fulfilment_method && <p className="text-xs text-muted-foreground">{t.methodChangeNote}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button size="sm" onClick={save}>
          {t.save}
        </Button>
      </div>
    </fieldset>
  );
}

function PaymentPanel({
  order: o,
  busy,
  onSet,
}: {
  order: OrderView;
  busy: boolean;
  onSet: (patch: Parameters<typeof updateOrder>[1]) => void;
}) {
  const { t, locale } = useOrdersT();
  const methods: { m: OwnerPaymentMethod; label: string }[] = [
    { m: "cash", label: t.payCash },
    { m: "card_in_person", label: t.payCard },
    { m: "bank_transfer", label: t.payTransfer },
  ];
  const cap = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  const paid = o.payment_status === "paid";
  const how = methods.find((x) => x.m === o.payment_method)?.label;
  const title = paid ? t.paid : o.payment_status === "unpaid" ? t.notPaid : statusPayment(t, o.payment_status);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", paid ? "bg-emerald-500" : "bg-amber-500")} />
        <div className="text-sm">
          <p className={cn("font-medium", paid && "text-emerald-700 dark:text-emerald-400")}>{title}</p>
          <p className="tabular-nums text-muted-foreground">
            {formatMoney(paid ? (o.amount_paid_cents ?? o.total_cents) : o.total_cents, o.currency, locale)}
            {paid && how ? ` · ${cap(how)}` : ""}
          </p>
        </div>
      </div>
      {paid ? (
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onSet({ payment_status: "unpaid", payment_method: null, amount_paid_cents: null })}>
          {t.markUnpaid}
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">{t.markAsPaid}</span>
          {methods.map(({ m, label }) => (
            <Button key={m} size="sm" variant="outline" disabled={busy} onClick={() => onSet({ payment_status: "paid", payment_method: m })}>
              {cap(label)}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function ContactLink({
  href,
  icon: Icon,
  label,
  external,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-medium outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Icon aria-hidden className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

function statusPayment(t: OrdersT, s: OrderView["payment_status"]): string {
  return s === "refunded" ? t.payRefunded : s === "partially_refunded" ? t.payPartiallyRefunded : t.unpaidLine;
}

export function actionLabel(t: OrdersT, a: StepAction): string {
  const labels: Record<StepAction, string> = {
    confirm: t.actConfirm,
    reject: t.actReject,
    start_preparing: t.actStartPreparing,
    mark_ready: t.actMarkReady,
    out_for_delivery: t.actOutForDelivery,
    picked_up: t.actPickedUp,
    delivered: t.actDelivered,
    cancel: t.actCancel,
  };
  return labels[a];
}

// Dot colour per status, the same hues as StatusBadge; other events get a hollow dot.
const STATUS_DOT: Record<OrderStatus, string> = {
  pending: "bg-orange-500",
  confirmed: "bg-sky-500",
  preparing: "bg-violet-500",
  ready: "bg-emerald-500",
  out_for_delivery: "bg-emerald-500",
  completed: "bg-foreground/70",
  cancelled: "bg-muted-foreground/60",
  rejected: "bg-muted-foreground/60",
};

type HistoryEntry = { id: string; at: Date; title: string; who: string | null; reason: string | null; status: OrderStatus | null };

function historyEntry(t: OrdersT, e: OrderEvent): HistoryEntry {
  const who = e.actor === "owner" ? t.actorOwner : e.actor === "agent" ? t.actorAgent : e.actor === "customer" ? t.actorCustomer : t.actorSystem;
  const base = { id: e.id, at: new Date(e.created_at), who: null, reason: null, status: null };
  switch (e.type) {
    case "created":
      return { ...base, title: fill(t.evCreated, { who }), status: e.to_status };
    case "status": {
      if (e.actor === "system" && e.to_status === "cancelled") return { ...base, title: t.evExpired, status: "cancelled" };
      const reason = typeof e.data?.reason === "string" && e.data.reason !== "expired" ? e.data.reason : null;
      return { ...base, title: e.to_status ? statusLabel(t, e.to_status) : "", who, reason, status: e.to_status };
    }
    case "items":
      return { ...base, title: fill(t.evItems, { who }) };
    case "payment":
      return { ...base, title: fill(t.evPayment, { who }) };
    case "note":
      return { ...base, title: fill(t.evNote, { who }) };
    default:
      return { ...base, title: fill(t.evEdited, { who }) };
  }
}

// Newest first. A day label only where the day changes, so each row shows just
// the time; the dot colour echoes the status badge.
function HistoryTimeline({ events }: { events: OrderEvent[] | null }) {
  const { t, locale } = useOrdersT();
  const timeFmt = useMemo(() => new Intl.DateTimeFormat(locale, { timeStyle: "short" }), [locale]);
  const dayFmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: "medium" }), [locale]);
  if (events === null) {
    return (
      <div aria-hidden className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  const entries = events.map((e) => historyEntry(t, e)).reverse();
  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dayLabel = (d: Date) =>
    dayKey(d) === dayKey(now) ? t.today : dayKey(d) === dayKey(yesterday) ? t.yesterday : dayFmt.format(d);
  return (
    <ol className="text-sm">
      {entries.map((e, i) => {
        const newDay = i === 0 || dayKey(entries[i - 1].at) !== dayKey(e.at);
        const last = i === entries.length - 1;
        return (
          <li key={e.id}>
            {newDay && (
              <p className={cn("mb-2 text-xs font-medium text-muted-foreground", i > 0 && "mt-1")}>{dayLabel(e.at)}</p>
            )}
            <div className={cn("relative flex gap-3", !last && "pb-4")}>
              {/* rail to the next entry */}
              {!last && <span aria-hidden className="absolute bottom-0 left-[4.5px] top-4 w-px bg-border" />}
              <span
                aria-hidden
                className={cn(
                  "relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                  e.status ? STATUS_DOT[e.status] : "border border-muted-foreground/50 bg-background",
                  i === 0 && "ring-4 ring-muted",
                )}
              />
              <div className="min-w-0">
                <p className={cn(i === 0 ? "font-medium" : "text-foreground/90")}>{e.title}</p>
                {e.reason && <p className="text-muted-foreground">“{e.reason}”</p>}
                <p className="text-xs text-muted-foreground">
                  {e.who ? `${e.who} · ` : ""}
                  <time dateTime={e.at.toISOString()}>{timeFmt.format(e.at)}</time>
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
