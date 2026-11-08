"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { checkUsernameAvailability, type UsernameAvailability } from "@/features/auth/actions/check-username";
import { changeUsername, loadUsernameChangeStatus } from "../actions/change-username";
import {
  USERNAME_CHANGE_LIMIT,
  USERNAME_CHANGE_WINDOW_DAYS,
  type UsernameChangeStatus,
} from "../domain/username-change";

const FORMAT = /^[a-z0-9_-]{2,30}$/;

export function UsernameSettingsCard({
  username,
  onChanged,
}: {
  username: string;
  onChanged: (username: string) => void;
}) {
  const router = useRouter();
  const { t, locale } = useLanguage();
  const s = t.settings;

  const [value, setValue] = useState(username);
  const [status, setStatus] = useState<UsernameChangeStatus | null>(null);
  const [availability, setAvailability] = useState<UsernameAvailability | "checking" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const next = value.trim().toLowerCase();
  const unchanged = next === username;
  const locked = status?.changesLeft === 0;

  useEffect(() => {
    loadUsernameChangeStatus().then((res) => {
      if (res.ok) setStatus({ changesLeft: res.changesLeft, nextChangeAt: res.nextChangeAt });
    });
  }, []);

  // Debounced availability check while typing a different, well-formed name.
  useEffect(() => {
    if (unchanged || !next) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset derived check state
      setAvailability(null);
      return;
    }
    if (!FORMAT.test(next)) {
      setAvailability("invalid");
      return;
    }
    setAvailability("checking");
    let cancelled = false;
    const id = setTimeout(async () => {
      const res = await checkUsernameAvailability(next);
      if (!cancelled) setAvailability(res);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [next, unchanged]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  const handleConfirm = async () => {
    setError("");
    const res = await changeUsername({ username: next });
    if (!res.ok) {
      const messages: Record<typeof res.error, string> = {
        INVALID_USERNAME: s.usernameInvalid,
        SAME_USERNAME: s.usernameSame,
        USERNAME_TAKEN: s.usernameTaken,
        RATE_LIMITED: s.usernameRateLimited,
        UNAUTHENTICATED: s.usernameError,
        FAILED: s.usernameError,
      };
      setError(messages[res.error]);
      return;
    }
    setStatus({ changesLeft: res.changesLeft, nextChangeAt: res.nextChangeAt });
    setValue(res.username);
    setSaved(true);
    onChanged(res.username);
    // Sidebar / navbar profile links re-read the profile.
    window.dispatchEvent(new Event("profile-updated"));
    router.refresh();
  };

  const canSave = !unchanged && !locked && availability === "available";

  const hint =
    availability === "invalid"
      ? { text: s.usernameInvalid, tone: "text-destructive" }
      : availability === "taken"
        ? { text: s.usernameTaken, tone: "text-destructive" }
        : availability === "available"
          ? { text: s.usernameAvailable, tone: "text-emerald-600 dark:text-emerald-400" }
          : null;

  return (
    <Card className="w-full shadow-lg shadow-black/5 dark:shadow-black/20 border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{s.usernameTitle}</CardTitle>
        <CardDescription>
          {s.usernameDesc
            .replace("{limit}", String(USERNAME_CHANGE_LIMIT))
            .replace("{days}", String(USERNAME_CHANGE_WINDOW_DAYS))}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSave) setConfirmOpen(true);
          }}
        >
          <div className="relative flex-1">
            <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => {
                setValue(e.target.value.toLowerCase());
                setSaved(false);
                setError("");
              }}
              disabled={locked}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-label={s.usernameTitle}
              className="pl-9 pr-9"
            />
            {availability === "checking" && (
              <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
            {availability === "available" && (
              <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-600" />
            )}
          </div>
          <Button type="submit" disabled={!canSave}>
            {s.usernameSave}
          </Button>
        </form>

        <p className="text-xs text-muted-foreground">nandzz.com/{next || username}</p>
        {hint && <p className={`text-xs ${hint.tone}`}>{hint.text}</p>}
        {error && <p className="text-xs text-destructive">{error}</p>}
        {saved && <p className="text-xs text-emerald-600 dark:text-emerald-400">{s.usernameSaved}</p>}

        {status && (
          <p className="text-xs text-muted-foreground">
            {locked && status.nextChangeAt
              ? s.usernameNextChange.replace("{date}", formatDate(status.nextChangeAt))
              : s.usernameChangesLeft
                  .replace("{count}", String(status.changesLeft))
                  .replace("{limit}", String(USERNAME_CHANGE_LIMIT))}
          </p>
        )}
      </CardContent>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        title={s.usernameConfirmTitle}
        description={s.usernameConfirmDesc
          .replace("{username}", next)
          .replace("{limit}", String(USERNAME_CHANGE_LIMIT))
          .replace("{days}", String(USERNAME_CHANGE_WINDOW_DAYS))}
        confirmLabel={s.usernameConfirm}
        cancelLabel={t.common.cancel}
        variant="default"
      />
    </Card>
  );
}
