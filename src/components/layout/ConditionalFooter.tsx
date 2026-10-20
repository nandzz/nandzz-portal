"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

export function ConditionalFooter({ tabBar }: { tabBar?: boolean }) {
  const pathname = usePathname();
  if (/^\/[^/]+\/space\/[^/]+/.test(pathname)) return null;
  return <Footer tabBar={tabBar} />;
}
