"use client";

import { Store, Truck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { dialForRegion, isPossiblePhoneNumber, splitE164, toE164 } from "@/features/booking/domain/phone";
import { PhoneCountrySelect } from "@/features/booking/components/PhoneCountrySelect";
import type { DeliveryAddress, FulfilmentMethod } from "../types";
import { Field, useOrdersT } from "./shared";

// Form pieces shared by "New order" and the order sheet's edit mode.

/** `phone` is the national number; `phoneRegion` picks the dial code (same model as the booking widget). */
export type CustomerDraft = { name: string; phoneRegion: string; phone: string; email: string };

/** Draft from a stored order. Phones are E.164; older free-text ones stay as typed under the default country. */
export function customerDraft(
  o: { customer_name: string; customer_phone: string | null; customer_email: string | null } | null,
  defaultRegion: string,
): CustomerDraft {
  const stored = o?.customer_phone?.trim() ?? "";
  const split = stored.startsWith("+") ? splitE164(stored) : { region: defaultRegion, national: stored };
  return { name: o?.customer_name ?? "", phoneRegion: split.region, phone: split.national, email: o?.customer_email ?? "" };
}

/** E.164 ("+39347…") or null when no number was typed. */
export function phoneFromDraft(c: CustomerDraft): string | null {
  return c.phone.trim() ? toE164(dialForRegion(c.phoneRegion), c.phone) : null;
}
export type FulfilmentDraft = {
  method: FulfilmentMethod;
  date: string;
  from: string;
  to: string;
  address: { line1: string; line2: string; city: string; postal_code: string; notes: string };
};

export const emptyAddress = { line1: "", line2: "", city: "", postal_code: "", notes: "" };

export function addressFromDraft(a: FulfilmentDraft["address"]): DeliveryAddress {
  const clean = (s: string) => s.trim() || null;
  return { line1: a.line1.trim(), line2: clean(a.line2), city: clean(a.city), postal_code: clean(a.postal_code), notes: clean(a.notes) };
}

export function draftFromAddress(a: DeliveryAddress | null): FulfilmentDraft["address"] {
  return {
    line1: a?.line1 ?? "",
    line2: a?.line2 ?? "",
    city: a?.city ?? "",
    postal_code: a?.postal_code ?? "",
    notes: a?.notes ?? "",
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Field problems as i18n keys, before the DB checks the rest. */
export function validateDrafts(c: CustomerDraft, f: FulfilmentDraft) {
  return {
    name: c.name.trim().length < 1 || c.name.trim().length > 120,
    email: !!c.email.trim() && !EMAIL_RE.test(c.email.trim()),
    phone: !!c.phone.trim() && !isPossiblePhoneNumber(c.phone),
    date: !/^\d{4}-\d{2}-\d{2}$/.test(f.date),
    time: !!f.to && (!f.from || f.to <= f.from),
    address: f.method === "delivery" && !f.address.line1.trim(),
  };
}

export function CustomerFields({
  value,
  onChange,
  errors,
}: {
  value: CustomerDraft;
  onChange: (v: CustomerDraft) => void;
  errors: { name: boolean; email: boolean; phone: boolean };
}) {
  const { t } = useOrdersT();
  // autoComplete off: this is the customer's data typed by the owner, so the
  // browser must not fill in the owner's own name, phone or address.
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label={t.customerName} error={errors.name ? t.nameRequired : null} className="sm:col-span-2">
        <Input
          value={value.name}
          maxLength={120}
          autoComplete="off"
          enterKeyHint="next"
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          aria-invalid={errors.name}
        />
      </Field>
      <Field label={t.customerPhone} optional error={errors.phone ? t.fieldInvalid : null}>
        <div className="flex min-w-0 gap-2">
          <PhoneCountrySelect
            value={value.phoneRegion}
            onChange={(phoneRegion) => onChange({ ...value, phoneRegion })}
            className="h-8 rounded-lg border border-input bg-background text-base focus-visible:ring-2 focus-visible:ring-ring/50 md:text-sm"
          />
          <Input
            type="tel"
            inputMode="tel"
            value={value.phone}
            maxLength={20}
            autoComplete="off"
            enterKeyHint="next"
            aria-label={t.customerPhone}
            onChange={(e) => onChange({ ...value, phone: e.target.value })}
            aria-invalid={errors.phone}
          />
        </div>
      </Field>
      <Field label={t.customerEmail} optional error={errors.email ? t.fieldInvalid : null}>
        <Input
          type="email"
          value={value.email}
          maxLength={254}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="next"
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          aria-invalid={errors.email}
        />
      </Field>
    </div>
  );
}

export function FulfilmentFields({
  value,
  onChange,
  errors,
  pickupAddress,
}: {
  value: FulfilmentDraft;
  onChange: (v: FulfilmentDraft) => void;
  errors: { date: boolean; time: boolean; address: boolean };
  pickupAddress: string | null;
}) {
  const { t } = useOrdersT();
  const methods: { m: FulfilmentMethod; label: string; icon: typeof Store }[] = [
    { m: "pickup", label: t.pickup, icon: Store },
    { m: "delivery", label: t.delivery, icon: Truck },
  ];
  const setAddr = (k: keyof FulfilmentDraft["address"], v: string) => onChange({ ...value, address: { ...value.address, [k]: v } });
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label={t.fulfilment} className="grid grid-cols-2 gap-2">
        {methods.map(({ m, label, icon: Icon }) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={value.method === m}
            onClick={() => onChange({ ...value, method: m })}
            className={cn(
              "flex h-10 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium outline-none transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring/50",
              value.method === m ? "border-foreground bg-muted/60" : "border-border text-muted-foreground hover:bg-muted/40",
            )}
          >
            <Icon aria-hidden className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>
      {/* Phone: the date gets its own row, the time window sits side by side. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={t.fulfilDate} error={errors.date ? t.fieldInvalid : null} className="col-span-2 sm:col-span-1">
          <Input type="date" value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} aria-invalid={errors.date} />
        </Field>
        <Field label={t.fulfilFrom} optional>
          <Input type="time" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} />
        </Field>
        <Field label={t.fulfilTo} optional error={errors.time ? t.timeInvalid : null}>
          <Input type="time" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} aria-invalid={errors.time} />
        </Field>
      </div>
      {value.method === "pickup" ? (
        pickupAddress && <p className="text-xs text-muted-foreground">{pickupAddress}</p>
      ) : (
        // Phone: street and apartment full width, city + a narrow postcode
        // together. Wider: street | apartment, city | postcode.
        <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3 sm:grid-cols-6">
          <Field label={t.addressLine1} error={errors.address ? t.addressRequired : null} className="col-span-2 sm:col-span-4">
            <Input
              value={value.address.line1}
              maxLength={200}
              autoComplete="off"
              enterKeyHint="next"
              onChange={(e) => setAddr("line1", e.target.value)}
              aria-invalid={errors.address}
            />
          </Field>
          <Field label={t.addressLine2} optional className="col-span-2 sm:col-span-2">
            <Input value={value.address.line2} maxLength={200} autoComplete="off" enterKeyHint="next" onChange={(e) => setAddr("line2", e.target.value)} />
          </Field>
          <Field label={t.city} optional className="sm:col-span-4">
            <Input value={value.address.city} maxLength={200} autoComplete="off" enterKeyHint="next" onChange={(e) => setAddr("city", e.target.value)} />
          </Field>
          <Field label={t.postalCode} optional className="sm:col-span-2">
            <Input
              value={value.address.postal_code}
              maxLength={20}
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="next"
              onChange={(e) => setAddr("postal_code", e.target.value)}
            />
          </Field>
          <Field label={t.deliveryNotes} optional className="col-span-2 sm:col-span-6">
            <Input
              value={value.address.notes}
              maxLength={200}
              autoComplete="off"
              onChange={(e) => setAddr("notes", e.target.value)}
              placeholder={t.deliveryNotesPlaceholder}
            />
          </Field>
        </div>
      )}
    </div>
  );
}
