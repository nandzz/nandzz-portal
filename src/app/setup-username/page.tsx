"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Sparkles } from "lucide-react";

export default function SetupUsernamePage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmed = username.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,30}$/.test(trimmed)) {
      setError(
        "Username must be 3–30 characters: lowercase letters, numbers, hyphens, underscores"
      );
      setLoading(false);
      return;
    }

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        username: trimmed,
        display_name: displayName.trim() || trimmed,
      });

      if (insertError) {
        if (insertError.code === "23505") {
          setError("That username is already taken. Try another.");
        } else {
          setError(insertError.message);
        }
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-100/50 blur-3xl dark:bg-violet-950/25" />
      </div>

      <Card className="w-full max-w-md shadow-xl shadow-black/5 dark:shadow-black/20 border-border/60">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-900/50">
            <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <CardTitle className="text-2xl font-bold">One last step</CardTitle>
          <CardDescription className="text-base">
            Choose a username for your profile
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                placeholder="johndoe"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
              <p className="text-xs text-muted-foreground">
                3–30 characters. Letters, numbers, hyphens, underscores only.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="displayName">
                Display Name{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="displayName"
                placeholder="John Doe"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Setting up..." : "Get started"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
