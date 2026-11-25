"use client";

import { Dialog } from "./dialog";
import { Sheet, useSheetLayout } from "./sheet";
import { cn } from "@/lib/utils";

/**
 * The owner-panel convention: a bottom sheet below `sm`, a centered dialog
 * above. Used by My Agent and Orders. Only for panels that open on interaction
 * (the layout is decided on the client).
 */
export function ResponsivePanel({
  open,
  onClose,
  title,
  children,
  footer,
  maxWidthClass = "max-w-lg",
  bodyClassName,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Sticky action bar (pinned to the sheet's bottom on phones). */
  footer?: React.ReactNode;
  /** Dialog width on larger screens. */
  maxWidthClass?: string;
  /** Extra classes for the dialog's scrolling body (e.g. a taller cap). */
  bodyClassName?: string;
}) {
  const sheet = useSheetLayout();
  if (sheet) {
    return (
      <Sheet open={open} onOpenChange={(next) => !next && onClose()} aria-label={title} className="max-h-[85dvh]">
        <div className="px-5 pb-2 pt-1">
          {/* Same size as the desktop dialog title. */}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && (
          <div className="border-t border-border/60 bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onClose={onClose} title={title} maxWidthClass={maxWidthClass}>
      <div className={cn("max-h-[60vh] overflow-y-auto", bodyClassName)}>{children}</div>
      {footer && <div className="mt-5 border-t border-border/60 pt-4">{footer}</div>}
    </Dialog>
  );
}
