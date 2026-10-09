import Link from "next/link";
import type { ReactNode } from "react";

// Typography primitives shared by every legal document body, so the content
// files stay readable prose instead of className soup.

export function P({ children }: { children: ReactNode }) {
  return <p className="mt-3">{children}</p>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mt-5 font-medium text-foreground">{children}</h3>;
}

export function Ul({ children }: { children: ReactNode }) {
  return <ul className="mt-2 list-disc space-y-1.5 pl-6">{children}</ul>;
}

export function Ol({ children }: { children: ReactNode }) {
  return <ol className="mt-2 list-decimal space-y-1.5 pl-6">{children}</ol>;
}

export function B({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

const LINK = "text-violet-600 hover:underline dark:text-violet-400";

// Internal route, external URL or mailto — picks the right element.
export function A({ href, children }: { href: string; children?: ReactNode }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href} className={LINK}>
        {children ?? href}
      </Link>
    );
  }
  if (href.startsWith("mailto:")) {
    return (
      <a href={href} className={LINK}>
        {children ?? href.slice("mailto:".length)}
      </a>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children ?? href}
    </a>
  );
}

export function Mail({ to }: { to: string }) {
  return <A href={`mailto:${to}`}>{to}</A>;
}

export function Table({ head, rows }: { head: ReactNode[]; rows: ReactNode[][] }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[36rem] text-left text-sm leading-6">
        <thead className="bg-muted/50 text-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row, r) => (
            <tr key={r} className="align-top">
              {row.map((cell, c) => (
                <td key={c} className="px-3 py-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Highlighted plain-language summary at the top of a document.
export function Summary({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border bg-muted/30 p-5">
      <p className="font-medium text-foreground">{title}</p>
      <div className="[&>ul]:mt-2">{children}</div>
    </div>
  );
}
