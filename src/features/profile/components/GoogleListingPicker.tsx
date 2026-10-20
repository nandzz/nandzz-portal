"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Loader2, Search, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/contexts/LanguageContext";

// Establishment-only sibling of AddressAutocomplete: the owner searches for
// their Google business listing so the review link gets a reviewable place_id.
// Same Places API (New) key and session-token billing model.
const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

export type GoogleListingPick = {
  placeId: string;
  name: string;
  address: string;
};

interface GoogleListingPickerProps {
  onPick: (listing: GoogleListingPick) => void;
  placeholder?: string;
  noResultsLabel?: string;
  id?: string;
}

export function GoogleListingPicker({ onPick, placeholder, noResultsLabel, id }: GoogleListingPickerProps) {
  const { locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GoogleListingPick[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();

  const containerRef = useRef<HTMLDivElement>(null);
  // One session token spans all keystrokes up to a pick; the pick closes the
  // session with an IDs-only Place Details call (free tier), which makes the
  // session's autocomplete requests free too.
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    if (!PLACES_KEY) return;
    const q = query.trim();
    const timer = setTimeout(async () => {
      if (q.length < MIN_QUERY) {
        abortRef.current?.abort();
        setSuggestions([]);
        setSearched(false);
        setOpen(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(AUTOCOMPLETE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": PLACES_KEY,
          },
          body: JSON.stringify({
            input: q,
            sessionToken: sessionTokenRef.current,
            languageCode: locale,
            includedPrimaryTypes: ["establishment"],
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn("[google-review] Places autocomplete failed", res.status, body);
          throw new Error(String(res.status));
        }
        const data = await res.json();
        const next: GoogleListingPick[] = (data.suggestions ?? [])
          .map((s: { placePrediction?: unknown }) => s.placePrediction)
          .filter(Boolean)
          .map(
            (p: {
              placeId: string;
              structuredFormat?: {
                mainText?: { text?: string };
                secondaryText?: { text?: string };
              };
              text?: { text?: string };
            }) => ({
              placeId: p.placeId,
              name: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
              address: p.structuredFormat?.secondaryText?.text ?? "",
            }),
          );
        if (controller.signal.aborted) return;
        setSuggestions(next);
        setSearched(true);
        setActiveIndex(-1);
        setOpen(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn("[google-review] Places request error", err);
          setSuggestions([]);
        }
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [query, locale]);

  const handleSelect = (s: GoogleListingPick) => {
    abortRef.current?.abort();
    setOpen(false);
    setActiveIndex(-1);
    setQuery("");
    setSuggestions([]);
    setSearched(false);
    onPick(s);
    // Close the billing session. IDs-only field mask = free Details SKU; the
    // response isn't needed (the prediction already has name + address).
    const token = sessionTokenRef.current;
    sessionTokenRef.current = crypto.randomUUID();
    if (PLACES_KEY) {
      void fetch(`https://places.googleapis.com/v1/places/${s.placeId}?sessionToken=${token}`, {
        headers: { "X-Goog-Api-Key": PLACES_KEY, "X-Goog-FieldMask": "id" },
      }).catch(() => {});
    }
  };

  if (!PLACES_KEY) return null;

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-0 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-border/60 bg-muted/50 text-muted-foreground">
          <Search className="h-4 w-4" />
        </span>
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          onChange={(e) => setQuery(e.target.value.slice(0, 200))}
          onFocus={() => searched && setOpen(true)}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          onKeyDown={(e) => {
            const listOpen = open && suggestions.length > 0;
            if (e.key === "Escape" && listOpen) {
              e.stopPropagation();
              setOpen(false);
            } else if (e.key === "ArrowDown" && suggestions.length > 0) {
              e.preventDefault();
              setOpen(true);
              setActiveIndex((i) => (i + 1) % suggestions.length);
            } else if (e.key === "ArrowUp" && listOpen) {
              e.preventDefault();
              setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
            } else if (e.key === "Enter" && listOpen) {
              e.preventDefault();
              handleSelect(suggestions[activeIndex >= 0 ? activeIndex : 0]);
            }
          }}
          maxLength={200}
          autoComplete="off"
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {loading && <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {open && searched && (
        <ul id={listId} role="listbox" className="scrollbar-hide absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border/60 bg-background shadow-lg">
          {suggestions.length === 0 && noResultsLabel && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{noResultsLabel}</li>
          )}
          {suggestions.map((s, i) => (
            <li key={s.placeId} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${i === activeIndex ? "bg-accent" : "hover:bg-accent"}`}
              >
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  {s.address && (
                    <span className="block truncate text-xs text-muted-foreground">{s.address}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
