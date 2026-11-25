"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ResponsivePanel } from "@/components/ui/responsive-panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { createManualOrder } from "../actions/orders";
import type { ProductView } from "../server/load-products";
import { ItemPicker, type PickedLine } from "./ItemPicker";
import {
  CustomerFields,
  FulfilmentFields,
  addressFromDraft,
  customerDraft,
  emptyAddress,
  phoneFromDraft,
  validateDrafts,
  type CustomerDraft,
  type FulfilmentDraft,
} from "./OrderFields";
import { orderErrorText } from "./orderErrors";
import { Field, useOrdersT } from "./shared";

// Orders the owner takes by phone, Instagram or in the shop. Created already
// confirmed. The owner may override their own scheduling rules here; stock is
// still enforced by the DB.
export function ManualOrderDialog({
  products,
  currency,
  today,
  pickupAddress,
  defaultPhoneRegion,
  onClose,
  onCreated,
}: {
  products: ProductView[];
  currency: string;
  today: string;
  pickupAddress: string | null;
  defaultPhoneRegion: string;
  onClose: () => void;
  onCreated: (orderNumber: number, orderId: string) => void;
}) {
  const { t } = useOrdersT();
  const router = useRouter();
  // One id per dialog: a double click or a retry after a timeout can't create two orders.
  const [requestId] = useState(() => crypto.randomUUID());
  const [lines, setLines] = useState<PickedLine[]>([]);
  const [customer, setCustomer] = useState<CustomerDraft>(() => customerDraft(null, defaultPhoneRegion));
  const [fulfilment, setFulfilment] = useState<FulfilmentDraft>({ method: "pickup", date: today, from: "", to: "", address: emptyAddress });
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  const errors = validateDrafts(customer, fulfilment);
  const noItems = lines.length === 0;
  const shown = submitted ? errors : { name: false, email: false, phone: false, date: false, time: false, address: false };
  const dirty = lines.length > 0 || !!customer.name || !!customer.phone || !!note;

  const requestClose = () => {
    if (saving || confirmDiscard) return;
    if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  const submit = async () => {
    setSubmitted(true);
    setError(null);
    if (noItems || Object.values(errors).some(Boolean) || saving) return;
    setSaving(true);
    const res = await createManualOrder({
      items: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, note: l.note.trim() || null })),
      fulfilment_method: fulfilment.method,
      fulfil_on: fulfilment.date,
      fulfil_from: fulfilment.from || null,
      fulfil_to: fulfilment.to || null,
      delivery_address: fulfilment.method === "delivery" ? addressFromDraft(fulfilment.address) : null,
      customer_name: customer.name.trim(),
      customer_phone: phoneFromDraft(customer),
      customer_email: customer.email.trim() || null,
      customer_note: note.trim() || null,
      client_request_id: requestId,
    });
    setSaving(false);
    if (!res.ok) {
      setError(orderErrorText(t, res.error, res.detail, products));
      return;
    }
    router.refresh();
    onCreated(res.orderNumber, res.orderId);
  };

  return (
    <ResponsivePanel
      open
      onClose={requestClose}
      title={t.newOrder}
      maxWidthClass="max-w-2xl"
      bodyClassName="-mx-6 max-h-[65vh] px-6 pb-1"
      footer={
        <div className="space-y-3">
          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={requestClose} disabled={saving}>
              {t.cancel}
            </Button>
            <Button onClick={submit} disabled={saving} className="max-sm:flex-1">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t.createOrder}
            </Button>
          </div>
        </div>
      }
    >
      {/* Sections divided by a rule; headings a step above field labels. */}
      <fieldset disabled={saving} className="min-w-0 space-y-6 [&>section+section]:border-t [&>section+section]:border-border/60 [&>section+section]:pt-6">
        <section className="space-y-3">
          <h3 className="text-base font-semibold">{t.items}</h3>
          <ItemPicker products={products} lines={lines} onChange={setLines} currency={currency} />
          {submitted && noItems && <p className="text-xs text-destructive">{t.needItems}</p>}
        </section>
        <section className="space-y-3">
          <h3 className="text-base font-semibold">{t.customer}</h3>
          <CustomerFields value={customer} onChange={setCustomer} errors={shown} />
        </section>
        <section className="space-y-3">
          <h3 className="text-base font-semibold">{t.fulfilment}</h3>
          <FulfilmentFields value={fulfilment} onChange={setFulfilment} errors={shown} pickupAddress={pickupAddress} />
        </section>
        <Field label={t.customerNote} optional>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} rows={2} />
        </Field>
        <p className="text-xs text-muted-foreground">{t.manualOrderHint}</p>
      </fieldset>


      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={onClose}
        title={t.discardOrderTitle}
        description={t.discardOrderBody}
        confirmLabel={t.discard}
        cancelLabel={t.keepEditing}
      />
    </ResponsivePanel>
  );
}
