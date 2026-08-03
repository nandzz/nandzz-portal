"use client";

import { useState } from "react";
import { X, Plus, Trash2, Save, Bot, AlertTriangle } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const MAX_QUESTIONS = 6;
const MAX_QUESTION_CHARS = 120;

interface AgentSettingsProps {
  username: string;
  initialEnabled: boolean;
  initialQuestions: string[];
  onClose: () => void;
  onSaved: (next: { enabled: boolean; questions: string[] }) => void;
}

export function AgentSettings({
  username,
  initialEnabled,
  initialQuestions,
  onClose,
  onSaved,
}: AgentSettingsProps) {
  const { t } = useLanguage();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [questions, setQuestions] = useState<string[]>(
    initialQuestions.length > 0 ? initialQuestions : [""]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQuestion(index: number, value: string) {
    setQuestions((prev) => prev.map((q, i) => (i === index ? value.slice(0, MAX_QUESTION_CHARS) : q)));
  }

  function removeQuestion(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  function addQuestion() {
    setQuestions((prev) => (prev.length >= MAX_QUESTIONS ? prev : [...prev, ""]));
  }

  async function save() {
    setSaving(true);
    setError(null);
    const cleaned = questions.map((q) => q.trim()).filter(Boolean).slice(0, MAX_QUESTIONS);
    try {
      const res = await fetch("/api/agent/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_enabled: enabled, agent_suggested_questions: cleaned }),
      });
      if (!res.ok) throw new Error("save failed");
      // Bust the profile page's cache so enable/disable is reflected immediately.
      fetch("/api/profile/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      }).catch(() => {});
      onSaved({ enabled, questions: cleaned });
      onClose();
    } catch {
      setError(t.agent.settingsError);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex flex-col w-full sm:max-w-md max-h-[90dvh] bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-violet-100 dark:bg-violet-900/40">
              <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            </div>
            <h2 className="text-sm font-semibold">{t.agent.settingsTitle}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t.agent.close}
            className="cursor-pointer p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Enable toggle */}
          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => setEnabled((v) => !v)}
                className={`relative flex-shrink-0 mt-0.5 h-5 w-9 rounded-full transition-colors ${
                  enabled ? "bg-violet-600" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    enabled ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm">
                <span className="font-medium">{t.agent.enableLabel}</span>
                <span className="block text-xs text-muted-foreground mt-0.5">{t.agent.enableHint}</span>
              </span>
            </label>
          </div>

          {/* Suggested questions */}
          <div className="space-y-2">
            <div>
              <h3 className="text-sm font-medium">{t.agent.suggestedQuestionsLabel}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{t.agent.suggestedQuestionsHint}</p>
            </div>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => updateQuestion(i, e.target.value)}
                    placeholder={t.agent.questionPlaceholder}
                    maxLength={MAX_QUESTION_CHARS}
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                  />
                  <button
                    onClick={() => removeQuestion(i)}
                    aria-label={t.agent.delete}
                    className="cursor-pointer flex-shrink-0 p-2 rounded-lg text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-muted transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            {questions.length < MAX_QUESTIONS && (
              <button
                onClick={addQuestion}
                className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <Plus className="w-3 h-3" />
                {t.agent.addQuestion}
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border">
          {error && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-950/30 text-xs text-red-600 dark:text-red-400 border-b border-red-200 dark:border-red-800/50">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2 px-4 py-3">
            <button
              onClick={onClose}
              className="cursor-pointer text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
            >
              {t.agent.cancel}
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Save className="w-3 h-3" />
              {saving ? t.agent.savingSettings : t.agent.saveSettings}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
