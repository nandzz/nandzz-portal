"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Globe,
  Lock,
  AlertTriangle,
  Clock,
  CheckCircle,
  Trash2,
  X,
  Save,
  Eye,
  Sparkles,
} from "lucide-react";
import type { AgentDocument, AgentDocStatus, AgentDocVisibility, Profile } from "@/lib/types";
import { SetupAssistant } from "./SetupAssistant";
import { AgentChat } from "./AgentChat";

interface AgentStudioProps {
  profile: Profile;
}

const STATUS_META: Record<AgentDocStatus, { label: string; icon: typeof CheckCircle; className: string }> = {
  active: { label: "Active", icon: CheckCircle, className: "text-emerald-600 dark:text-emerald-400" },
  outdated: { label: "Outdated", icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  needs_review: { label: "Needs Review", icon: AlertTriangle, className: "text-orange-600 dark:text-orange-400" },
};

function DocBadge({ doc }: { doc: AgentDocument }) {
  const statusMeta = STATUS_META[doc.status];
  const StatusIcon = statusMeta.icon;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${
          doc.visibility === "public"
            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
            : "border-border bg-muted text-muted-foreground"
        }`}
      >
        {doc.visibility === "public" ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
        {doc.visibility === "public" ? "Public" : "Private"}
      </span>
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${statusMeta.className}`}>
        <StatusIcon className="w-2.5 h-2.5" />
        {statusMeta.label}
      </span>
      {doc.is_sensitive && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="w-2.5 h-2.5" />
          Sensitive
        </span>
      )}
    </div>
  );
}

type DraftDoc = {
  id?: string;
  title: string;
  content: string;
  visibility: AgentDocVisibility;
  status: AgentDocStatus;
  is_sensitive: boolean;
  sort_order: number;
};

const emptyDraft = (): DraftDoc => ({
  title: "",
  content: "",
  visibility: "public",
  status: "active",
  is_sensitive: false,
  sort_order: 100,
});

type MobileTab = "knowledge" | "guide";
type GuideTab = "templates" | "advisor";

export function AgentStudio({ profile }: AgentStudioProps) {
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<DraftDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("knowledge");
  const [guideTab, setGuideTab] = useState<GuideTab>("advisor");

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/agent/documents");
    if (res.ok) setDocs(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  function openNew() {
    setDraft(emptyDraft());
    setMobileTab("knowledge");
  }

  function openFromTemplate(title: string, content: string) {
    setDraft({ title, content, visibility: "public", status: "active", is_sensitive: false, sort_order: 100 });
    setMobileTab("knowledge");
  }

  function openEdit(doc: AgentDocument) {
    setDraft({
      id: doc.id,
      title: doc.title,
      content: doc.content,
      visibility: doc.visibility,
      status: doc.status,
      is_sensitive: doc.is_sensitive,
      sort_order: doc.sort_order,
    });
  }

  function closeEditor() {
    setDraft(null);
  }

  async function saveDoc() {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    try {
      const isNew = !draft.id;
      const url = isNew ? "/api/agent/documents" : `/api/agent/documents/${draft.id}`;
      const method = isNew ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (res.ok) {
        const saved: AgentDocument = await res.json();
        setDocs((prev) =>
          isNew ? [saved, ...prev] : prev.map((d) => (d.id === saved.id ? saved : d))
        );
        setDraft(null);
        fetch(`/api/agent/documents/${saved.id}/embed`, { method: "POST" }).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteDoc(id: string) {
    const res = await fetch(`/api/agent/documents/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (draft?.id === id) setDraft(null);
    }
  }

  // ─── Panels ────────────────────────────────────────────────────────────────

  const knowledgePanel = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">Knowledge</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {docs.length} document{docs.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNew}
          className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-3 h-3" />
          New
        </button>
      </div>

      {/* Document list OR Editor */}
      {draft ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">
              {draft.id ? "Edit document" : "New document"}
            </span>
            <button onClick={closeEditor} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Title</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => d && { ...d, title: e.target.value })}
                placeholder="e.g. about-me.md"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            {/* Visibility + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Visibility</label>
                <select
                  value={draft.visibility}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, visibility: e.target.value as AgentDocVisibility })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, status: e.target.value as AgentDocStatus })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="active">Active</option>
                  <option value="outdated">Outdated</option>
                  <option value="needs_review">Needs Review</option>
                </select>
              </div>
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Prompt order
                <span className="font-normal ml-1 text-muted-foreground/60">— lower = injected first</span>
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={draft.sort_order}
                onChange={(e) => setDraft((d) => d && { ...d, sort_order: Number(e.target.value) })}
                className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            {/* Sensitive toggle */}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.is_sensitive}
                onChange={(e) => setDraft((d) => d && { ...d, is_sensitive: e.target.checked })}
                className="w-4 h-4 accent-red-500 cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-red-600 dark:text-red-400">Sensitive</span>
                {" "}— contains personal or restricted information
              </span>
            </label>

            {/* Content */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                Content <span className="font-normal">(Markdown)</span>
              </label>
              <textarea
                value={draft.content}
                onChange={(e) => setDraft((d) => d && { ...d, content: e.target.value })}
                placeholder="Write the document content in Markdown…"
                rows={12}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none min-h-[160px]"
              />
            </div>
          </div>

          {/* Editor footer */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-t border-border bg-background">
            {draft.id ? (
              <button
                onClick={() => deleteDoc(draft.id!)}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            ) : (
              <div />
            )}
            <div className="flex gap-2">
              <button
                onClick={closeEditor}
                className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveDoc}
                disabled={saving || !draft.title.trim()}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="w-3 h-3" />
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
              <FileText className="w-8 h-8 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">No documents yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add documents to teach your agent
                </p>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {docs.map((doc) => (
                <li key={doc.id}>
                  <button
                    onClick={() => openEdit(doc)}
                    className="cursor-pointer w-full text-left px-4 py-3.5 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <p className="text-sm font-medium truncate group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                            {doc.title}
                          </p>
                          <span className="flex-shrink-0 text-[10px] text-muted-foreground/60 tabular-nums">
                            {doc.char_count >= 1000
                              ? `${(doc.char_count / 1000).toFixed(1)}k`
                              : doc.char_count} ch
                          </span>
                        </div>
                        <div className="mt-1">
                          <DocBadge doc={doc} />
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );

  const displayName = profile.display_name || profile.username;

  const guidePanel = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex gap-1 p-0.5 rounded-lg bg-muted">
          <button
            onClick={() => setGuideTab("advisor")}
            className={`cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              guideTab === "advisor"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Advisor
          </button>
          <button
            onClick={() => setGuideTab("templates")}
            className={`cursor-pointer flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-medium transition-colors ${
              guideTab === "templates"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <FileText className="w-3 h-3" />
            Templates
          </button>
        </div>
        <a
          href={`/${profile.username}/agent/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Eye className="w-3 h-3" />
          Preview
        </a>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {guideTab === "advisor" ? (
          <AgentChat
            username={profile.username}
            displayName={displayName}
            onDocumentCreated={(doc) => {
              setDocs((prev) => {
                const exists = prev.some((d) => d.id === doc.id);
                return exists
                  ? prev.map((d) => (d.id === doc.id ? doc : d))
                  : [doc, ...prev];
              });
              // If the owner has this exact document open in the editor, close it so
              // they can't accidentally overwrite the AI's update with a stale draft.
              setDraft((d) => (d?.id === doc.id ? null : d));
            }}
          />
        ) : (
          <SetupAssistant docs={docs} onUseTemplate={openFromTemplate} hideChatUI />
        )}
      </div>
    </div>
  );

  // ─── Layout ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] overflow-hidden">

      {/* Mobile tab bar — hidden on md+ */}
      <div className="md:hidden flex-shrink-0 flex border-b border-border bg-background">
        {(["knowledge", "guide"] as MobileTab[]).map((tab) => {
          const isActive = mobileTab === tab;
          const Icon = tab === "knowledge" ? FileText : Sparkles;
          const label = tab === "knowledge" ? "Knowledge" : "Guide";
          const badge = tab === "knowledge" && docs.length > 0 ? docs.length : null;
          return (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`cursor-pointer flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative ${
                isActive
                  ? "text-violet-600 dark:text-violet-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {badge !== null && (
                <span className="text-xs tabular-nums text-muted-foreground/70">{badge}</span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-6 right-6 h-0.5 rounded-full bg-violet-600 dark:bg-violet-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel area */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* Left / Knowledge panel */}
        <div
          className={`
            flex-col overflow-hidden bg-background
            md:flex md:w-[45%] md:border-r md:border-border
            ${mobileTab === "knowledge" ? "flex w-full" : "hidden"}
          `}
        >
          {knowledgePanel}
        </div>

        {/* Right / Guide panel */}
        <div
          className={`
            flex-col overflow-hidden bg-background
            md:flex md:flex-1
            ${mobileTab === "guide" ? "flex w-full" : "hidden"}
          `}
        >
          {guidePanel}
        </div>

      </div>
    </div>
  );
}
