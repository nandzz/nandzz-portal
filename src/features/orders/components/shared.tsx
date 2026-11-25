"use client";

import { useId } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";

// Small building blocks shared by the Orders tabs.

/** Fills `{name}` placeholders in a dictionary string. */
export function fill(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Orders strings + the viewer's locale. */
export function useOrdersT() {
  const { t, locale } = useLanguage();
  return { t: t.orders, locale };
}

export type OrdersT = ReturnType<typeof useOrdersT>["t"];

export function errorText(t: OrdersT, code: string): string {
  switch (code) {
    case "NOT_ENTITLED":
      return t.errNotEntitled;
    case "INVALID_INPUT":
      return t.errInvalid;
    case "PRODUCT_LIMIT":
      return t.errProductLimit;
    case "IMAGE_LIMIT":
      return t.errImageLimit;
    case "NOT_FOUND":
      return t.errNotFound;
    default:
      return t.errFailed;
  }
}

/**
 * One form field for every Orders form: the label (with "(optional)" inline,
 * wrapping instead of being cut off), the control, then a hint or the error
 * under it. Inside a grid the three parts sit on the parent's rows (subgrid),
 * so a label that wraps to two lines never pushes its input below the
 * neighbours'. Outside a grid it is a plain stack.
 */
export function Field({
  label,
  optional,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  optional?: boolean;
  hint?: string;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}) {
  const { t } = useOrdersT();
  const note = error || hint;
  return (
    <label className={cn("row-span-3 grid min-w-0 grid-rows-subgrid content-start gap-1.5", className)}>
      <span className="self-end text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted-foreground"> ({t.optional})</span>}
      </span>
      {children}
      {note && <span className={cn("block text-xs", error ? "text-destructive" : "text-muted-foreground")}>{note}</span>}
    </label>
  );
}

/**
 * A labelled block of controls that isn't one input (radio cards, day pills,
 * a photo grid): label, optional right-side note, the controls 8px below,
 * then a hint. Same rhythm as Field, so blocks and fields read as one form.
 */
export function FieldGroup({
  label,
  aside,
  hint,
  className,
  children,
}: {
  label: string;
  aside?: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span id={id} className="block text-sm font-medium">
          {label}
        </span>
        {aside}
      </div>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ElementType;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border px-6 py-12 text-center">
      <Icon aria-hidden className="mb-3 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Pill filter button (status / category), same look as the booking Services filter. */
export function FilterPill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium outline-none transition-[background-color,color,border-color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-ring/50",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground/70")}>{count}</span>
      )}
    </button>
  );
}
