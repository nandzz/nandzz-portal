"use client";

import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CalendarConfig } from "@/lib/types";
import { MessageTemplateEditor } from "@/components/widgets/calendar/MessageTemplateEditor";
import type { CalendarConfigController } from "@/components/widgets/calendar/useCalendarConfig";
import { useLanguage } from "@/contexts/LanguageContext";

interface Props {
  controller: CalendarConfigController;
}

export function NotificationsManager({ controller }: Props) {
  const { t } = useLanguage();
  const { config, setConfig, saving, status, save } = controller;

  function patch(update: Partial<CalendarConfig>) {
    setConfig((c) => ({ ...c, ...update }));
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-border bg-background p-5 space-y-4">
        <div>
          <h2 className="font-semibold">{t.booking.automatedMessagesTitle}</h2>
          <p className="text-sm text-muted-foreground">{t.booking.automatedMessagesDesc}</p>
        </div>
        <MessageTemplateEditor
          title={t.booking.confirmationMsgTitle}
          description={t.booking.confirmationMsgDesc}
          value={config.messages.confirmation}
          onChange={(msg) => patch({ messages: { ...config.messages, confirmation: msg } })}
        />
        <MessageTemplateEditor
          title={t.booking.cancellationMsgTitle}
          description={t.booking.cancellationMsgDesc}
          value={config.messages.cancellation}
          onChange={(msg) => patch({ messages: { ...config.messages, cancellation: msg } })}
        />
      </section>

      {/* Save bar — persists the whole shared config via the controller, so
          saving here also commits Availability/Services edits and vice versa. */}
      <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3 rounded-xl border border-border bg-background/90 p-3 backdrop-blur">
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-600" : "text-red-600"}`}>
            {status.ok && <Check className="mr-1 inline h-4 w-4" />}
            {status.msg}
          </span>
        )}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {t.booking.saveChanges}
        </Button>
      </div>
    </div>
  );
}
