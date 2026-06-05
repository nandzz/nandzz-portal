"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Phone, AlertTriangle } from "lucide-react";

type PhoneState = "loading" | "none" | "unverified" | "verified";
type Step = "input" | "otp";

export function PhoneVerificationForm() {
  const [phoneState, setPhoneState] = useState<PhoneState>("loading");
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [justVerified, setJustVerified] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.phone) {
        setPhoneState("none");
      } else if (!user.phone_confirmed_at) {
        setCurrentPhone(user.phone);
        setPhone(user.phone);
        setPhoneState("unverified");
      } else {
        setCurrentPhone(user.phone);
        setPhoneState("verified");
      }
    });
  }, [supabase]);

  const sendOtp = async (phoneNumber: string) => {
    setError("");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ phone: phoneNumber });
      if (error) {
        setError(error.message);
        return false;
      }
      return true;
    } catch {
      setError("An unexpected error occurred");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError("Enter a valid phone number with country code (e.g. +15551234567)");
      return;
    }
    const ok = await sendOtp(phone);
    if (ok) setStep("otp");
  };

  const handleResendOtp = async () => {
    if (!currentPhone) return;
    const ok = await sendOtp(currentPhone);
    if (ok) setStep("otp");
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (otp.length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: otp,
        type: "phone_change",
      });
      if (error) {
        setError(error.message);
      } else {
        setCurrentPhone(phone);
        setPhoneState("verified");
        setJustVerified(true);
        setOtp("");
        setStep("input");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (phoneState === "loading") return null;

  return (
    <div className="space-y-4">
      {/* Verified badge */}
      {phoneState === "verified" && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/50 border border-border/50 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
          <p className="text-sm text-muted-foreground">
            Verified:{" "}
            <span className="font-mono text-foreground">{currentPhone}</span>
          </p>
        </div>
      )}

      {/* Unverified warning */}
      {phoneState === "unverified" && step === "input" && (
        <div className="flex items-start gap-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 px-3 py-2">
          <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              <span className="font-mono">{currentPhone}</span> is not verified yet.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResendOtp}
              disabled={loading}
              className="h-7 text-xs border-yellow-300 dark:border-yellow-700"
            >
              {loading ? "Sending..." : "Send verification code"}
            </Button>
          </div>
        </div>
      )}

      {/* Just verified success */}
      {justVerified && (
        <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
          <p className="text-sm text-green-700 dark:text-green-400">
            Phone number verified successfully!
          </p>
        </div>
      )}

      {/* OTP entry step */}
      {step === "otp" && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A 6-digit code was sent to{" "}
            <span className="font-mono text-foreground">{phone}</span>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="otp">Verification code</Label>
            <Input
              id="otp"
              type="text"
              inputMode="numeric"
              placeholder="123456"
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
              }
              maxLength={6}
              required
              className="bg-muted/50 border-border/60 focus:border-violet-500/50 focus:bg-background transition-colors font-mono tracking-[0.5em] text-center text-lg"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? "Verifying..." : "Verify code"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep("input");
                setOtp("");
                setError("");
              }}
            >
              Back
            </Button>
          </div>
        </form>
      )}

      {/* Add / update phone form */}
      {step === "input" && (phoneState === "none" || phoneState === "verified") && (
        <form onSubmit={handleSendOtp} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">
              {phoneState === "verified" ? "Update phone number" : "Phone number"}
            </Label>
            <div className="flex items-center gap-0 rounded-md border border-border/60 bg-background overflow-hidden focus-within:border-violet-500/50 transition-colors">
              <span className="px-3 h-9 flex items-center border-r border-border/60 bg-muted/50">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <Input
                id="phone"
                type="tel"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Include country code (e.g. +1 for US, +44 for UK)
            </p>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send verification code"}
          </Button>
        </form>
      )}
    </div>
  );
}
