"use client";

import { usePathname } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";

// Neutral skeleton (no copy) that mirrors the tab being opened: one route
// (`[[...section]]`) serves Orders, Products and Settings, so the path picks
// which layout to sketch. Keep these in step with OrdersTab, ProductsTab and
// SettingsTab.
const bar = "rounded bg-muted animate-pulse";

export default function OrdersLoading() {
  const section = usePathname().split("/")[3] ?? "orders";
  return (
    <PageShell width="content">
      {/* Header: icon, title + preview badge, subtitle */}
      <div className="mb-6 flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 rounded-xl bg-muted animate-pulse" />
        <div className="space-y-2">
          <div className={`h-7 w-40 ${bar}`} />
          <div className={`h-4 w-56 max-w-full ${bar}`} />
        </div>
      </div>
      {/* Line tabs: three triggers over a rule */}
      <div className="mb-6 flex gap-6 border-b border-border/60 pb-2.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`h-5 w-20 ${bar}`} />
        ))}
      </div>
      {section === "products" ? <ProductsSkeleton /> : section === "settings" ? <SettingsSkeleton /> : <OrdersSkeleton />}
    </PageShell>
  );
}

function Pills({ n }: { n: number }) {
  return (
    <div className="flex gap-2 overflow-hidden">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="h-8 w-20 shrink-0 rounded-full bg-muted animate-pulse" />
      ))}
    </div>
  );
}

function Toolbar() {
  return (
    <div className="flex gap-3">
      <div className="h-9 flex-1 rounded-lg bg-muted animate-pulse" />
      <div className="h-9 w-28 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}

function OrdersSkeleton() {
  return (
    <div className="space-y-4">
      {/* Counters */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-[62px] rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
      <Toolbar />
      <Pills n={6} />
      {/* Day groups: heading + rows in one card */}
      {[3, 2].map((rows, g) => (
        <section key={g} className="space-y-2 pt-1">
          <div className={`h-4 w-24 ${bar}`} />
          <div className="divide-y divide-border/60 rounded-xl border border-border/60">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className={`h-3 w-10 ${bar}`} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className={`h-4 w-40 max-w-full ${bar}`} />
                  <div className={`h-3 w-56 max-w-full ${bar}`} />
                </div>
                <div className={`h-8 w-20 rounded-lg ${bar}`} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ProductsSkeleton() {
  return (
    <div className="space-y-4">
      <Toolbar />
      <Pills n={3} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-border/60">
            <div className="aspect-square bg-muted animate-pulse" />
            <div className="space-y-2 p-3">
              <div className={`h-4 w-3/4 ${bar}`} />
              <div className={`h-3 w-1/2 ${bar}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-6">
      {[3, 2, 2].map((rows, s) => (
        <section key={s} className="space-y-4 rounded-xl border border-border/60 p-4 sm:p-5">
          <div className="space-y-2">
            <div className={`h-5 w-36 ${bar}`} />
            <div className={`h-4 w-64 max-w-full ${bar}`} />
          </div>
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className={`h-4 w-28 ${bar}`} />
              <div className="h-8 w-full rounded-lg bg-muted animate-pulse" />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
