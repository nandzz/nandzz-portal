"use client";

import { useEffect, useId, useRef, useState } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ProfileAddress } from "@/lib/types";
import { useLanguage } from "@/contexts/LanguageContext";

// Google Places API (New) — called directly from the browser. The key is a
// NEXT_PUBLIC var protected by HTTP-referrer restrictions on the GCP side; if
// it's unset the field silently degrades to a plain free-text address input.
const PLACES_KEY = process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
const AUTOCOMPLETE_URL = "https://places.googleapis.com/v1/places:autocomplete";
const MIN_QUERY = 3;
const DEBOUNCE_MS = 300;

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
};

interface AddressAutocompleteProps {
  value: ProfileAddress | null;
  onChange: (address: ProfileAddress | null) => void;
  placeholder?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder,
  id,
}: AddressAutocompleteProps) {
  const { locale } = useLanguage();
  const [query, setQuery] = useState(value?.formatted ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();

  // Only text the user TYPED triggers a (billed) Places request — not the
  // pre-filled saved address when the dialog opens, nor the label/formatted
  // address we write back after a selection (those used to reopen the list).
  const userTypedRef = useRef(false);
  // Guards the details request against a newer pick/typing overwriting it.
  const selectSeqRef = useRef(0);

  const containerRef = useRef<HTMLDivElement>(null);
  // One Places session token spans all keystrokes up to a selection; resetting it
  // after a pick starts a fresh billable session (keeps autocomplete cheap).
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const abortRef = useRef<AbortController | null>(null);

  // Close the dropdown on any outside pointer press.
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  // Debounced autocomplete fetch. No-op without a key (plain-text fallback).
  // All state updates live inside the timer callback (async) so the effect body
  // itself never calls setState synchronously.
  useEffect(() => {
    if (!PLACES_KEY || !userTypedRef.current) return;
    const q = query.trim();
    const timer = setTimeout(async () => {
      if (q.length < MIN_QUERY) {
        abortRef.current?.abort();
        setSuggestions([]);
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
          }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.warn("[address] Places autocomplete failed", res.status, body);
          throw new Error(String(res.status));
        }
        const data = await res.json();
        const next: Suggestion[] = (data.suggestions ?? [])
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
              mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
              secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
            }),
          );
        if (controller.signal.aborted) return;
        setSuggestions(next);
        setActiveIndex(-1);
        setOpen(next.length > 0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn("[address] Places request error", err);
          setSuggestions([]);
        }
      } finally {
        if (abortRef.current === controller) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      // A response for an older query must never land after newer typing.
      abortRef.current?.abort();
    };
  }, [query, locale]);

  // Keep the parent in sync with the typed text so free text still persists
  // (and still deep-links to Maps) even when no suggestion is picked.
  const handleInput = (text: string) => {
    userTypedRef.current = true;
    selectSeqRef.current++;
    setQuery(text);
    onChange(text.trim() ? { formatted: text } : null);
  };

  const handleClear = () => {
    userTypedRef.current = false;
    selectSeqRef.current++;
    abortRef.current?.abort();
    setLoading(false);
    setQuery("");
    setSuggestions([]);
    setOpen(false);
    onChange(null);
  };

  const handleSelect = async (s: Suggestion) => {
    userTypedRef.current = false;
    abortRef.current?.abort();
    const seq = ++selectSeqRef.current;
    setOpen(false);
    setActiveIndex(-1);
    setQuery(s.mainText);
    // Optimistically persist the label; enrich with details below.
    onChange({ formatted: [s.mainText, s.secondaryText].filter(Boolean).join(", ") });
    if (!PLACES_KEY) return;
    try {
      const res = await fetch(
        `https://places.googleapis.com/v1/places/${s.placeId}?languageCode=${locale}&sessionToken=${sessionTokenRef.current}`,
        {
          headers: {
            "X-Goog-Api-Key": PLACES_KEY,
            "X-Goog-FieldMask": "id,formattedAddress,location",
          },
        },
      );
      if (res.ok) {
        const d = await res.json();
        if (seq !== selectSeqRef.current) return; // superseded by newer input
        setQuery(d.formattedAddress ?? s.mainText);
        onChange({
          formatted:
            d.formattedAddress ??
            [s.mainText, s.secondaryText].filter(Boolean).join(", "),
          place_id: d.id ?? s.placeId,
          lat: d.location?.latitude,
          lng: d.location?.longitude,
        });
      }
    } catch {
      // Keep the optimistic value; details are a best-effort enrichment.
    } finally {
      // Selection closes the billing session — start a new token next time.
      sessionTokenRef.current = crypto.randomUUID();
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center gap-0 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center border-r border-border/60 bg-muted/50 text-muted-foreground">
          <MapPin className="h-4 w-4" />
        </span>
        <Input
          id={id}
          value={query}
          placeholder={placeholder}
          onChange={(e) => handleInput(e.target.value.slice(0, 300))}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          onKeyDown={(e) => {
            const listOpen = open && suggestions.length > 0;
            // Let Escape dismiss the dropdown without closing the whole dialog.
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
              // Pick the suggestion instead of submitting the whole profile form.
              e.preventDefault();
              void handleSelect(suggestions[activeIndex >= 0 ? activeIndex : 0]);
            }
          }}
          maxLength={300}
          autoComplete="off"
          className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
        {loading && (
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={handleClear}
            aria-label="Clear address"
            className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul id={listId} role="listbox" className="scrollbar-hide absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border/60 bg-background shadow-lg">
          {suggestions.map((s, i) => (
            <li key={s.placeId} id={`${listId}-${i}`} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left text-sm transition-colors ${i === activeIndex ? "bg-accent" : "hover:bg-accent"}`}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.mainText}</span>
                  {s.secondaryText && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.secondaryText}
                    </span>
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
