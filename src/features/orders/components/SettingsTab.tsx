"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bot, PauseCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { FEATURES } from "@/lib/flags";
import type { AvailabilityWindows } from "@/lib/types";
import { SaveBar } from "@/features/booking/components/calendar/SaveBar";
import { TimezoneSelect } from "@/features/booking/components/calendar/TimezoneSelect";
import { WIDGET_CURRENCIES, currencySymbol } from "@/features/booking/domain/messages";
import { centsToInput, parseMoneyInput } from "../domain/money";
import { saveOrderSettings } from "../actions/settings";
import type { SettingsData } from "../server/load-settings";
import type { AskCustomerEmail, SlotMinutes } from "../types";
import { WeeklyHoursEditor, hoursValid } from "./WeeklyHoursEditor";
import { Field, fill, useOrdersT } from "./shared";

const SLOTS: SlotMinutes[] = [0, 15, 30, 60, 120];

// "" ⇒ null; whole number in [min, max] ⇒ number; anything else ⇒ undefined.
function intOrNull(raw: string, min: number, max: number): number | null | undefined {
  const s = raw.trim();
  if (!s) return null;
  if (!/^\d+$/.test(s)) return undefined;
  const n = Number(s);
  return n >= min && n <= max ? n : undefined;
}
function moneyOrNull(raw: string): number | null | undefined {
  if (!raw.trim()) return null;
  return parseMoneyInput(raw) ?? undefined;
}

export function SettingsTab({ data, readOnly }: { data: SettingsData; readOnly: boolean }) {
  const { t } = useOrdersT();
  const router = useRouter();
  const s = data.settings;

  const [accepting, setAccepting] = useState(s?.accepting_orders ?? false);
  const [pausedUntil, setPausedUntil] = useState(s?.paused_until ?? "");
  const [pauseMessage, setPauseMessage] = useState(s?.pause_message ?? "");
  const [currency, setCurrency] = useState(s?.currency ?? data.defaults.currency);
  const [timezone, setTimezone] = useState(s?.timezone ?? data.defaults.timezone);
  const [maxPerDay, setMaxPerDay] = useState(s?.max_orders_per_day?.toString() ?? "");

  const [pickupOn, setPickupOn] = useState(s?.pickup_enabled ?? true);
  const [pickupAddress, setPickupAddress] = useState(s?.pickup_address ?? "");
  const [pickupHours, setPickupHours] = useState<AvailabilityWindows | null>(s?.pickup_hours ?? null);
  const [pickupSlot, setPickupSlot] = useState<SlotMinutes>(s?.pickup_slot_minutes ?? 60);

  const [deliveryOn, setDeliveryOn] = useState(s?.delivery_enabled ?? false);
  const [fee, setFee] = useState(centsToInput(s?.delivery_fee_cents ?? 0));
  const [freeOver, setFreeOver] = useState(s?.free_delivery_over_cents != null ? centsToInput(s.free_delivery_over_cents) : "");
  const [minOrder, setMinOrder] = useState(s?.delivery_min_order_cents != null ? centsToInput(s.delivery_min_order_cents) : "");
  const [area, setArea] = useState(s?.delivery_area ?? "");
  const [deliveryHours, setDeliveryHours] = useState<AvailabilityWindows | null>(s?.delivery_hours ?? null);
  const [deliverySlot, setDeliverySlot] = useState<SlotMinutes>(s?.delivery_slot_minutes ?? 60);

  const [leadTime, setLeadTime] = useState((s?.default_lead_time_hours ?? 24).toString());
  const [daysAhead, setDaysAhead] = useState((s?.max_days_ahead ?? 30).toString());
  const [expiry, setExpiry] = useState((s?.pending_expiry_hours ?? 24).toString());
  const [cutoff, setCutoff] = useState((s?.cancel_cutoff_hours ?? 24).toString());

  const [askEmail, setAskEmail] = useState<AskCustomerEmail>(s?.ask_customer_email ?? "optional");
  const [payment, setPayment] = useState(s?.payment_instructions ?? "");
  const [allergens, setAllergens] = useState(s?.allergen_note ?? "");
  const [policy, setPolicy] = useState(s?.cancellation_policy ?? "");

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const parsed = {
    maxPerDay: intOrNull(maxPerDay, 1, 10000),
    fee: parseMoneyInput(fee || "0"),
    freeOver: moneyOrNull(freeOver),
    minOrder: moneyOrNull(minOrder),
    leadTime: intOrNull(leadTime, 0, 2160),
    daysAhead: intOrNull(daysAhead, 1, 365),
    expiry: intOrNull(expiry, 1, 720),
    cutoff: intOrNull(cutoff, 0, 720),
  };
  const bad = {
    maxPerDay: parsed.maxPerDay === undefined,
    fee: parsed.fee === null || parsed.fee > 10_000_000,
    freeOver: parsed.freeOver === undefined,
    minOrder: parsed.minOrder === undefined,
    leadTime: parsed.leadTime == null,
    daysAhead: parsed.daysAhead == null,
    expiry: parsed.expiry == null,
    cutoff: parsed.cutoff == null,
    pickupHours: !hoursValid(pickupHours),
    deliveryHours: !hoursValid(deliveryHours),
    // every day switched off would be stored as "no hours" = open every day
    pickupNoDay: pickupOn && pickupHours !== null && Object.keys(pickupHours).length === 0,
    deliveryNoDay: deliveryOn && deliveryHours !== null && Object.keys(deliveryHours).length === 0,
  };
  const invalid = Object.values(bad).some(Boolean);
  const err = (k: keyof typeof bad) => (submitted && bad[k] ? t.fieldInvalid : null);
  const hoursErr = (invalidKey: "pickupHours" | "deliveryHours", noDayKey: "pickupNoDay" | "deliveryNoDay") =>
    submitted ? (bad[noDayKey] ? t.needOpenDay : bad[invalidKey] ? t.hoursInvalid : null) : null;
  const noMethod = accepting && !pickupOn && !deliveryOn;

  const save = async () => {
    setSubmitted(true);
    setStatus(null);
    if (invalid || noMethod) {
      setStatus({ ok: false, msg: noMethod ? t.needMethod : t.fixFields });
      return;
    }
    setSaving(true);
    const res = await saveOrderSettings({
      accepting_orders: accepting,
      paused_until: pausedUntil || null,
      pause_message: pauseMessage,
      currency,
      timezone,
      max_orders_per_day: parsed.maxPerDay ?? null,
      pickup_enabled: pickupOn,
      pickup_address: pickupAddress,
      pickup_hours: pickupHours,
      pickup_slot_minutes: pickupSlot,
      delivery_enabled: deliveryOn,
      delivery_fee_cents: parsed.fee ?? 0,
      free_delivery_over_cents: parsed.freeOver ?? null,
      delivery_min_order_cents: parsed.minOrder ?? null,
      delivery_area: area,
      delivery_hours: deliveryHours,
      delivery_slot_minutes: deliverySlot,
      default_lead_time_hours: parsed.leadTime ?? 24,
      max_days_ahead: parsed.daysAhead ?? 30,
      pending_expiry_hours: parsed.expiry ?? 24,
      cancel_cutoff_hours: parsed.cutoff ?? 24,
      ask_customer_email: askEmail,
      payment_instructions: payment,
      allergen_note: allergens,
      cancellation_policy: policy,
    });
    setSaving(false);
    if (res.ok) {
      setStatus({ ok: true, msg: t.saved });
      router.refresh();
    } else {
      setStatus({ ok: false, msg: res.error === "INVALID_INPUT" ? t.fixFields : res.error === "NOT_ENTITLED" ? t.errNotEntitled : t.errFailed });
    }
  };

  const sym = currencySymbol(currency);

  return (
    <div className="space-y-6">
      {!s && (
        <p className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{t.settingsFirstTime}</p>
      )}

      <fieldset disabled={readOnly || saving} className="min-w-0 space-y-6">
        <Section title={t.secTaking} desc={t.secTakingDesc}>
          <ToggleRow label={t.acceptingOrders} hint={accepting ? t.acceptingOnHint : t.acceptingOffHint} checked={accepting} onChange={setAccepting} />
          <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
            <Field label={t.pausedUntil} optional>
              <Input type="date" value={pausedUntil} onChange={(e) => setPausedUntil(e.target.value)} />
            </Field>
            <Field label={t.pauseMessage} optional>
              <Input value={pauseMessage} onChange={(e) => setPauseMessage(e.target.value)} maxLength={300} placeholder={t.pauseMessagePlaceholder} />
            </Field>
          </div>
          {pausedUntil && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <PauseCircle aria-hidden className="h-3.5 w-3.5" /> {fill(t.pausedNote, { date: pausedUntil })}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={t.currency}>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={SELECT}>
                {WIDGET_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} · {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.timezone} className="sm:col-span-2">
              <TimezoneSelect value={timezone} onChange={setTimezone} />
            </Field>
          </div>
          {s && s.currency !== currency && <p className="text-xs text-amber-700 dark:text-amber-400">{t.currencyChangeNote}</p>}
          <Field label={t.maxOrdersPerDay} optional error={err("maxPerDay")} className="sm:max-w-xs">
            <Input value={maxPerDay} onChange={(e) => setMaxPerDay(e.target.value)} inputMode="numeric" placeholder={t.unlimited} />
          </Field>
        </Section>

        <Section title={t.secPickup} desc={t.secPickupDesc}>
          <ToggleRow label={t.pickupEnabled} checked={pickupOn} onChange={setPickupOn} />
          {pickupOn && (
            <>
              <Field label={t.pickupAddress}>
                <Input value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} maxLength={300} placeholder={t.pickupAddressPlaceholder} />
              </Field>
              <HoursBlock
                label={t.pickupHours}
                hours={pickupHours}
                setHours={setPickupHours}
                slot={pickupSlot}
                setSlot={setPickupSlot}
                error={hoursErr("pickupHours", "pickupNoDay")}
              />
            </>
          )}
        </Section>

        <Section title={t.secDelivery} desc={t.secDeliveryDesc}>
          <ToggleRow label={t.deliveryEnabled} checked={deliveryOn} onChange={setDeliveryOn} />
          {deliveryOn && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <MoneyField label={t.deliveryFee} sym={sym} value={fee} onChange={setFee} error={err("fee")} />
                <MoneyField label={t.freeDeliveryOver} optional sym={sym} value={freeOver} onChange={setFreeOver} error={err("freeOver")} />
                <MoneyField label={t.minOrder} optional sym={sym} value={minOrder} onChange={setMinOrder} error={err("minOrder")} />
              </div>
              <Field label={t.deliveryArea} hint={t.deliveryAreaHint}>
                <Textarea value={area} onChange={(e) => setArea(e.target.value)} maxLength={500} rows={2} placeholder={t.deliveryAreaPlaceholder} />
              </Field>
              <HoursBlock
                label={t.deliveryHours}
                hours={deliveryHours}
                setHours={setDeliveryHours}
                slot={deliverySlot}
                setSlot={setDeliverySlot}
                error={hoursErr("deliveryHours", "deliveryNoDay")}
              />
            </>
          )}
        </Section>

        <Section title={t.secTiming} desc={t.secTimingDesc}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t.defaultLeadTime} hint={t.defaultLeadTimeHint} error={err("leadTime")}>
              <Input value={leadTime} onChange={(e) => setLeadTime(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label={t.maxDaysAhead} hint={t.maxDaysAheadHint} error={err("daysAhead")}>
              <Input value={daysAhead} onChange={(e) => setDaysAhead(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label={t.pendingExpiry} hint={t.pendingExpiryHint} error={err("expiry")}>
              <Input value={expiry} onChange={(e) => setExpiry(e.target.value)} inputMode="numeric" />
            </Field>
            <Field label={t.cancelCutoff} hint={t.cancelCutoffHint} error={err("cutoff")}>
              <Input value={cutoff} onChange={(e) => setCutoff(e.target.value)} inputMode="numeric" />
            </Field>
          </div>
        </Section>

        <Section title={t.secCustomers} desc={t.secCustomersDesc}>
          <Field label={t.askEmail} className="sm:max-w-xs">
            <select value={askEmail} onChange={(e) => setAskEmail(e.target.value as AskCustomerEmail)} className={SELECT}>
              <option value="never">{t.askEmailNever}</option>
              <option value="optional">{t.askEmailOptional}</option>
              <option value="required">{t.askEmailRequired}</option>
            </select>
          </Field>
          <Field label={t.paymentInstructions} hint={t.paymentInstructionsHint}>
            <Textarea value={payment} onChange={(e) => setPayment(e.target.value)} maxLength={1000} rows={2} placeholder={t.paymentInstructionsPlaceholder} />
          </Field>
          <Field label={t.allergenNote} optional>
            <Textarea value={allergens} onChange={(e) => setAllergens(e.target.value)} maxLength={1000} rows={2} />
          </Field>
          <Field label={t.cancellationPolicy} optional>
            <Textarea value={policy} onChange={(e) => setPolicy(e.target.value)} maxLength={1000} rows={2} />
          </Field>
          {FEATURES.businessAgent && (
            <Link
              href="/dashboard/my-agent/settings"
              className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
            >
              <Bot aria-hidden className="h-4 w-4" /> {t.agentSettingsLink}
            </Link>
          )}
        </Section>
      </fieldset>

      {!readOnly && <SaveBar saving={saving} status={status} onSave={save} />}
    </div>
  );
}

// Same height and type size as <Input> (16px on phones, so iOS doesn't zoom in).
const SELECT =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm";

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-4 sm:p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted-foreground">{hint}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  );
}

function MoneyField({
  label,
  optional,
  sym,
  value,
  onChange,
  error,
}: {
  label: string;
  optional?: boolean;
  sym: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
}) {
  return (
    <Field label={label} optional={optional} error={error}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{sym}</span>
        <Input value={value} onChange={(e) => onChange(e.target.value)} inputMode="decimal" className="pl-10 tabular-nums" aria-invalid={!!error} />
      </div>
    </Field>
  );
}

function HoursBlock({
  label,
  hours,
  setHours,
  slot,
  setSlot,
  error,
}: {
  label: string;
  hours: AvailabilityWindows | null;
  setHours: (h: AvailabilityWindows | null) => void;
  slot: SlotMinutes;
  setSlot: (s: SlotMinutes) => void;
  error: string | null;
}) {
  const { t } = useOrdersT();
  const anyTime = hours === null;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium">{label}</span>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          {t.anyTimeEveryDay}
          <Switch
            checked={anyTime}
            onCheckedChange={(on) =>
              setHours(on ? null : { mon: [["09:00", "18:00"]], tue: [["09:00", "18:00"]], wed: [["09:00", "18:00"]], thu: [["09:00", "18:00"]], fri: [["09:00", "18:00"]], sat: [["09:00", "13:00"]] })
            }
            aria-label={t.anyTimeEveryDay}
          />
        </label>
      </div>
      {!anyTime && <WeeklyHoursEditor value={hours} onChange={setHours} />}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Field label={t.slotSize} hint={t.slotSizeHint} className="sm:max-w-xs">
        <select value={slot} onChange={(e) => setSlot(Number(e.target.value) as SlotMinutes)} className={SELECT}>
          {SLOTS.map((m) => (
            <option key={m} value={m}>
              {m === 0 ? t.slotAnyTime : fill(t.slotMinutes, { n: m })}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}
