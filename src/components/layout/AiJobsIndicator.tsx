"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2, CheckCircle2, XCircle, Trash2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type JobStatus = "pending" | "processing" | "done" | "error";

interface AiJob {
  id: string;
  space_id: string;
  instruction: string;
  status: JobStatus;
  status_text: string | null;
  created_at: string;
  spaces?: { title: string; profiles?: { username: string } } | null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function AiJobsIndicator({ userId }: { userId: string }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [open, setOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const confirmTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const requestDelete = useCallback((jobId: string) => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingId(jobId);
    // Auto-cancel confirmation after 4s
    confirmTimeoutRef.current = setTimeout(() => setConfirmingId(null), 4000);
  }, []);

  const cancelDelete = useCallback(() => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingId(null);
  }, []);

  const confirmDelete = useCallback(async (jobId: string) => {
    if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
    setConfirmingId(null);
    setJobs((prev) => prev.filter((j) => j.id !== jobId));
    await supabase.from("ai_edit_jobs").delete().eq("id", jobId);
  }, [supabase]);

  const fetchJobs = useCallback(async () => {
    const { data } = await supabase
      .from("ai_edit_jobs")
      .select("id, space_id, instruction, status, status_text, created_at, spaces(title, profiles(username))")
      .eq("user_id", userId)
      .in("status", ["pending", "processing", "done", "error"])
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setJobs(data as unknown as AiJob[]);
  }, [supabase, userId]);

  useEffect(() => {
    fetchJobs();
    return () => { if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current); };
  }, [fetchJobs]);

  // Realtime subscription for live updates
  useEffect(() => {
    const channel = supabase
      .channel(`ai-jobs-indicator-${userId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ai_edit_jobs",
        filter: `user_id=eq.${userId}`,
      }, () => { fetchJobs(); })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [supabase, userId, fetchJobs]);

  const activeJobs = jobs.filter((j) => j.status === "pending" || j.status === "processing");
  const hasActive = activeJobs.length > 0;

  if (jobs.length === 0) return null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="AI edit jobs"
      >
        <Sparkles className="h-5 w-5" />
        {hasActive && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-500 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-violet-600" />
          </span>
        )}
        {!hasActive && jobs.some((j) => j.status === "done") && (
          <span className="absolute top-1 right-1 flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
          <h3 className="text-sm font-semibold">AI Edits</h3>
          {hasActive && (
            <span className="ml-auto text-xs text-muted-foreground">{activeJobs.length} running</span>
          )}
        </div>

        <div className="max-h-[360px] overflow-y-auto">
          {jobs.map((job) => {
            const isActive = job.status === "pending" || job.status === "processing";
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const username = (job.spaces as any)?.profiles?.username;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const spaceTitle = (job.spaces as any)?.title ?? "Space";

            return (
              <div key={job.id} className="group flex items-start border-b last:border-0 hover:bg-accent transition-colors">
                <button
                  type="button"
                  onClick={() => {
                    if (username) {
                      router.push(`/${username}/space/${job.space_id}`);
                      setOpen(false);
                    }
                  }}
                  className="flex flex-1 items-start gap-3 px-4 py-3 text-left min-w-0"
                >
                  <div className="mt-0.5 shrink-0">
                    {isActive && <Loader2 className="h-4 w-4 animate-spin text-violet-500" />}
                    {job.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                    {job.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{spaceTitle}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      &ldquo;{job.instruction}&rdquo;
                    </p>
                    <p className="text-[11px] text-muted-foreground/60 mt-1">
                      {isActive
                        ? (job.status_text ?? "Working on it…")
                        : job.status === "done"
                        ? "Ready to apply"
                        : "Failed"}
                      {" · "}{relativeTime(job.created_at)}
                    </p>
                  </div>
                </button>
                <div className="shrink-0 self-center mr-3 flex items-center gap-1">
                  {confirmingId === job.id ? (
                    <>
                      <span className="text-[11px] text-muted-foreground mr-0.5">Delete?</span>
                      <button
                        type="button"
                        onClick={() => confirmDelete(job.id)}
                        className="rounded p-1 text-destructive hover:bg-destructive/10 transition-colors"
                        aria-label="Confirm delete"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelDelete}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        aria-label="Cancel delete"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => requestDelete(job.id)}
                      className="rounded-md p-1.5 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                      aria-label="Delete job"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
