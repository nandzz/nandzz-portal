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
  Settings,
} from "lucide-react";
import type { AgentDocument, AgentDocStatus, AgentDocVisibility, Profile } from "@/lib/types";
import { SetupAssistant } from "./SetupAssistant";
import { AgentChat } from "./AgentChat";
import { AgentSettings } from "./AgentSettings";
import { useLanguage } from "@/contexts/LanguageContext";

interface AgentStudioProps {
  profile: Profile;
}

const STATUS_META: Record<AgentDocStatus, { icon: typeof CheckCircle; className: string }> = {
  active: { icon: CheckCircle, className: "text-emerald-600 dark:text-emerald-400" },
  outdated: { icon: Clock, className: "text-amber-600 dark:text-amber-400" },
  needs_review: { icon: AlertTriangle, className: "text-orange-600 dark:text-orange-400" },
};

function DocBadge({ doc, labels }: { doc: AgentDocument; labels: { publicViz: string; privateViz: string; activeStatus: string; outdatedStatus: string; needsReviewStatus: string; sensitiveLabel: string } }) {
  const statusMeta = STATUS_META[doc.status];
  const StatusIcon = statusMeta.icon;
  const statusLabel = doc.status === "active" ? labels.activeStatus : doc.status === "outdated" ? labels.outdatedStatus : labels.needsReviewStatus;
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
        {doc.visibility === "public" ? labels.publicViz : labels.privateViz}
      </span>
      <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${statusMeta.className}`}>
        <StatusIcon className="w-2.5 h-2.5" />
        {statusLabel}
      </span>
      {doc.is_sensitive && (
        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 dark:text-red-400">
          <AlertTriangle className="w-2.5 h-2.5" />
          {labels.sensitiveLabel}
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
  const { t } = useLanguage();
  const docBadgeLabels = {
    publicViz: t.agent.publicViz,
    privateViz: t.agent.privateViz,
    activeStatus: t.agent.activeStatus,
    outdatedStatus: t.agent.outdatedStatus,
    needsReviewStatus: t.agent.needsReviewStatus,
    sensitiveLabel: t.agent.sensitiveLabel,
  };
  const [docs, setDocs] = useState<AgentDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [draft, setDraft] = useState<DraftDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("knowledge");
  const [guideTab, setGuideTab] = useState<GuideTab>("advisor");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [agentEnabled, setAgentEnabled] = useState(!!profile.agent_enabled);
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>(
    profile.agent_suggested_questions ?? []
  );

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch("/api/agent/documents");
      if (res.ok) {
        setDocs(await res.json());
      } else {
        setFetchError(true);
      }
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
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
    setSaveError(null);
    setDeleteError(null);
  }

  async function saveDoc() {
    if (!draft || !draft.title.trim()) return;
    setSaving(true);
    setSaveError(null);
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
      } else {
        const body = await res.json().catch(() => ({}));
        setSaveError(body.error ?? t.agent.failedSave);
      }
    } catch {
      setSaveError(t.agent.networkError);
    } finally {
      setSaving(false);
    }
  }

  async function deleteDoc(id: string) {
    setDeleteError(null);
    try {
      const res = await fetch(`/api/agent/documents/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDocs((prev) => prev.filter((d) => d.id !== id));
        if (draft?.id === id) setDraft(null);
      } else {
        setDeleteError(t.agent.failedDelete);
      }
    } catch {
      setDeleteError(t.agent.networkError);
    }
  }

  // ─── Panels ────────────────────────────────────────────────────────────────

  const knowledgePanel = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold">{t.agent.knowledge}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {docs.length} {docs.length === 1 ? t.agent.documentSingular : t.agent.documentPlural}
          </p>
        </div>
        <button
          onClick={openNew}
          className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors"
        >
          <Plus className="w-3 h-3" />
          {t.agent.new}
        </button>
      </div>

      {/* Document list OR Editor */}
      {draft ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Editor header */}
          <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
            <span className="text-xs font-medium text-muted-foreground">
              {draft.id ? t.agent.editDocument : t.agent.newDocument}
            </span>
            <button onClick={closeEditor} className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.agent.titleLabel}</label>
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((d) => d && { ...d, title: e.target.value })}
                placeholder={t.agent.titlePlaceholder}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              />
            </div>

            {/* Visibility + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.agent.visibilityLabel}</label>
                <select
                  value={draft.visibility}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, visibility: e.target.value as AgentDocVisibility })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="public">{t.agent.publicViz}</option>
                  <option value="private">{t.agent.privateViz}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t.agent.statusLabel}</label>
                <select
                  value={draft.status}
                  onChange={(e) =>
                    setDraft((d) => d && { ...d, status: e.target.value as AgentDocStatus })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  <option value="active">{t.agent.activeStatus}</option>
                  <option value="outdated">{t.agent.outdatedStatus}</option>
                  <option value="needs_review">{t.agent.needsReviewStatus}</option>
                </select>
              </div>
            </div>

            {/* Sort order */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t.agent.promptOrder}
                <span className="font-normal ml-1 text-muted-foreground/60">— {t.agent.promptOrderHint}</span>
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
                <span className="font-medium text-red-600 dark:text-red-400">{t.agent.sensitiveLabel}</span>
                {" "}— {t.agent.sensitiveDesc}
              </span>
            </label>

            {/* Content */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                {t.agent.contentLabel} <span className="font-normal">{t.agent.contentMarkdown}</span>
              </label>
              <textarea
                value={draft.content}
                onChange={(e) => setDraft((d) => d && { ...d, content: e.target.value })}
                placeholder={t.agent.contentPlaceholder}
                rows={12}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/40 resize-none min-h-[160px]"
              />
            </div>
          </div>

          {/* Editor footer */}
          <div className="flex-shrink-0 border-t border-border bg-background">
            {(saveError || deleteError) && (
              <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800/50">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                {saveError ?? deleteError}
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              {draft.id ? (
                <button
                  onClick={() => deleteDoc(draft.id!)}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t.agent.delete}
                </button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <button
                  onClick={closeEditor}
                  className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                >
                  {t.agent.cancel}
                </button>
                <button
                  onClick={saveDoc}
                  disabled={saving || !draft.title.trim()}
                  className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Save className="w-3 h-3" />
                  {saving ? t.agent.saving : t.agent.save}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-5 h-5 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
              <AlertTriangle className="w-8 h-8 text-red-400/70" />
              <div>
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{t.agent.failedLoad}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.agent.checkConnection}</p>
                <button
                  onClick={fetchDocs}
                  className="cursor-pointer text-xs text-violet-600 dark:text-violet-400 hover:underline mt-1"
                >
                  {t.agent.tryAgain}
                </button>
              </div>
            </div>
          ) : docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3 text-center px-6">
              <FileText className="w-8 h-8 text-muted-foreground/40" />
              <div>
                <p className="text-sm font-medium">{t.agent.noDocuments}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t.agent.noDocumentsDesc}
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
                          <DocBadge doc={doc} labels={docBadgeLabels} />
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
            {t.agent.advisor}
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
            {t.agent.templates}
          </button>
        </div>
        <a
          href={`/${profile.username}/agent/preview`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Eye className="w-3 h-3" />
          {t.agent.preview}
        </a>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden min-h-0">
        {guideTab === "advisor" ? (
          <AgentChat
            username={profile.username}
            displayName={displayName}
            docs={docs}
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

      {/* Info banner — what the public agent does + settings entry point */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-violet-200 dark:border-violet-800/60 bg-violet-50/70 dark:bg-violet-950/20">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40 flex-shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground leading-tight">{t.agent.bannerTitle}</p>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">{t.agent.bannerDesc}</p>
        </div>
        <span
          className={`hidden sm:inline-flex items-center gap-1 flex-shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border ${
            agentEnabled
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
              : "border-border bg-muted text-muted-foreground"
          }`}
        >
          {agentEnabled ? t.agent.agentLive : t.agent.agentHidden}
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="cursor-pointer inline-flex items-center gap-1.5 flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 bg-background hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
        >
          <Settings className="w-3.5 h-3.5" />
          {t.agent.settings}
        </button>
      </div>

      {settingsOpen && (
        <AgentSettings
          username={profile.username}
          initialEnabled={agentEnabled}
          initialQuestions={suggestedQuestions}
          onClose={() => setSettingsOpen(false)}
          onSaved={({ enabled, questions }) => {
            setAgentEnabled(enabled);
            setSuggestedQuestions(questions);
          }}
        />
      )}

      {/* Mobile tab bar — hidden on md+ */}
      <div className="md:hidden flex-shrink-0 flex border-b border-border bg-background">
        {(["knowledge", "guide"] as MobileTab[]).map((tab) => {
          const isActive = mobileTab === tab;
          const Icon = tab === "knowledge" ? FileText : Sparkles;
          const label = tab === "knowledge" ? t.agent.knowledge : t.agent.guide;
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
