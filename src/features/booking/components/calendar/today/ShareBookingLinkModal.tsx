"use client";

import { useEffect, useState, type ComponentType, type SVGProps } from "react";
import QRCode from "react-qr-code";
import { Check, Copy, Download, Mail, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/translations";
import { Dialog } from "@/components/ui/dialog";
import { WhatsAppIcon } from "@/components/icons/WhatsAppIcon";
import { FacebookIcon, InstagramIcon } from "@/components/icons/BrandIcons";
import { useQrDownload } from "@/features/spaces";
import { SHARE_MESSAGES, fillUrl } from "./shareMessages";

// Opened from the Today header: everything an owner needs to put their booking
// link in front of clients. Three tabs keep the dialog a fixed, short height:
// share (link + channels), a printable QR code, and ready-made texts for the
// WhatsApp Business away message and the Instagram bio. The texts sent to
// clients have their own language picker (defaults to the dashboard's).

export type ShareUrls = { booking: string; profile: string };

type Tab = "share" | "qr" | "texts";
type Target = keyof ShareUrls;

const INSTAGRAM_EDIT_URL = "https://www.instagram.com/accounts/edit/";

function useCopy() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
      return true;
    } catch {
      return false;
    }
  };
  return { copiedKey, copy };
}

export function ShareBookingLinkModal({ urls, onClose }: { urls: ShareUrls; onClose: () => void }) {
  const { t, locale } = useLanguage();
  const tt = t.bookingToday;

  const [tab, setTab] = useState<Tab>("share");
  const [target, setTarget] = useState<Target>("profile");
  const [lang, setLang] = useState<Locale>(locale);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const [instagramHint, setInstagramHint] = useState(false);
  const { copiedKey, copy } = useCopy();
  const { qrId, downloadPng, downloadSvg } = useQrDownload(tt.shareQrFileName);

  // navigator.share only exists client-side; checking after mount avoids a hydration mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setCanNativeShare(typeof navigator.share === "function"); }, []);

  const fullUrl = new URL(urls[target], window.location.origin).href;
  // What people see and paste: no scheme (WhatsApp, Instagram and mail apps
  // still turn it into a link). The QR code and the copy button use fullUrl.
  const shortUrl = fullUrl.replace(/^https?:\/\/(www\.)?/, "");
  const texts = SHARE_MESSAGES[lang];
  const [message, setMessage] = useState(() => fillUrl(texts.message, shortUrl));
  // Picking another language or link resets the editable message.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setMessage(fillUrl(texts.message, shortUrl)); }, [texts, shortUrl]);

  const open = (href: string) => window.open(href, "_blank", "noopener,noreferrer");

  const channels: { key: string; label: string; icon: ComponentType<SVGProps<SVGSVGElement>>; color: string; onClick: () => void }[] = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      icon: WhatsAppIcon,
      color: "text-[#25d366]",
      onClick: () => open(`https://wa.me/?text=${encodeURIComponent(message)}`),
    },
    {
      key: "instagram",
      label: "Instagram",
      icon: InstagramIcon,
      color: "text-[#e1306c]",
      // No web share target for Instagram: copy the link, then open the profile editor.
      onClick: async () => {
        await copy("instagram", fullUrl);
        setInstagramHint(true);
        open(INSTAGRAM_EDIT_URL);
      },
    },
    {
      key: "facebook",
      label: "Facebook",
      icon: FacebookIcon,
      color: "text-[#1877f2]",
      onClick: () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(fullUrl)}`),
    },
    {
      key: "email",
      label: tt.shareEmail,
      icon: Mail,
      color: "text-foreground",
      onClick: () => {
        window.location.assign(`mailto:?subject=${encodeURIComponent(texts.emailSubject)}&body=${encodeURIComponent(message)}`);
      },
    },
  ];

  const tabs: { key: Tab; label: string }[] = [
    { key: "share", label: tt.shareTabShare },
    { key: "qr", label: tt.shareTabQr },
    { key: "texts", label: tt.shareTabTexts },
  ];

  const readyTexts = [
    { key: "away", label: tt.shareTextAway, hint: tt.shareTextAwayHint, text: fillUrl(texts.away, shortUrl) },
    { key: "bio", label: tt.shareTextBio, hint: tt.shareTextBioHint, text: fillUrl(texts.instagramBio, shortUrl) },
  ];

  const languagePicker = (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {tt.shareMessageLanguage}
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Locale)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {SHARE_MESSAGES[l].name}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <Dialog open onClose={onClose} title={tt.shareTitle} maxWidthClass="max-w-lg">
      <p className="-mt-2 mb-4 text-sm text-muted-foreground">{tt.shareSubtitle}</p>

      {/* Which page the link opens */}
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm" role="radiogroup" aria-label={tt.shareTargetLabel}>
        {(["profile", "booking"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={target === key}
            onClick={() => setTarget(key)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              target === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {key === "booking" ? tt.shareTargetBooking : tt.shareTargetProfile}
          </button>
        ))}
      </div>

      {/* The link itself, always visible */}
      <div className="flex items-center gap-2 rounded-lg border border-border py-1 pl-3 pr-1">
        <span className="min-w-0 flex-1 truncate text-sm">{shortUrl}</span>
        <button
          type="button"
          onClick={() => copy("link", fullUrl)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {copiedKey === "link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copiedKey === "link" ? tt.shareCopied : tt.shareCopy}
        </button>
      </div>

      <div className="mt-5 flex gap-4 border-b border-border text-sm" role="tablist">
        {tabs.map((x) => (
          <button
            key={x.key}
            type="button"
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={cn(
              "-mb-px border-b-2 pb-2 font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              tab === x.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="pt-4">
        {tab === "share" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {channels.map(({ key, label, icon: Icon, color, onClick }) => (
                <button
                  key={key}
                  type="button"
                  onClick={onClick}
                  className="flex flex-col items-center gap-1.5 rounded-lg border border-border px-1 py-3 text-xs font-medium transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {key === "instagram" && copiedKey === "instagram" ? (
                    <Check className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <Icon className={cn("h-5 w-5", color)} />
                  )}
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
            {instagramHint && <p className="text-xs text-muted-foreground">{tt.shareInstagramHint}</p>}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-xs font-medium">{tt.shareMessageLabel}</span>
                {languagePicker}
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            {canNativeShare && (
              <button
                type="button"
                onClick={() => navigator.share({ text: message }).catch(() => {})}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-accent"
              >
                <Send className="h-4 w-4" /> {tt.shareMore}
              </button>
            )}
          </div>
        )}

        {tab === "qr" && (
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="shrink-0 rounded-lg bg-white p-3">
              <QRCode id={qrId} value={fullUrl} size={148} />
            </div>
            <div className="space-y-3 text-center sm:text-left">
              <p className="text-sm text-muted-foreground">{tt.shareQrHint}</p>
              <div className="flex justify-center gap-2 sm:justify-start">
                <button
                  type="button"
                  onClick={downloadPng}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
                >
                  <Download className="h-4 w-4" /> PNG
                </button>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm font-medium transition hover:bg-accent"
                >
                  <Download className="h-4 w-4" /> SVG
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "texts" && (
          <div className="space-y-4">
            <div className="flex justify-end">{languagePicker}</div>
            {readyTexts.map((x) => (
              <div key={x.key} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{x.label}</p>
                    <p className="text-xs text-muted-foreground">{x.hint}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(x.key, x.text)}
                    aria-label={tt.shareCopy}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs font-medium transition hover:bg-accent"
                  >
                    {copiedKey === x.key ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedKey === x.key ? tt.shareCopied : tt.shareCopy}
                  </button>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{x.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}
