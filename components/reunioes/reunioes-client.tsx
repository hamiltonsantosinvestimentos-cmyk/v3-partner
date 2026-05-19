"use client";

import React, { useState, useCallback } from "react";
import {
  Video,
  Sparkles,
  Loader2,
  CheckCircle2,
  Copy,
  Check,
  Plus,
  Trash2,
  ChevronRight,
  Calendar,
  Clock,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingSummary {
  id: string;
  title: string;
  summary: string;
  action_items: string[];
  participants: string[];
  duration_minutes: number | null;
  meeting_date: string;
  created_at: string;
}

interface GeneratedResult {
  id: string;
  title: string;
  summary: string;
  action_items: string[];
  key_decisions: string[];
  next_steps: string;
  sentiment: string;
  meeting_date: string;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface ReunioesClientProps {
  profile: Profile;
  initialSummaries: MeetingSummary[];
}

const SENTIMENT_CONFIG: Record<string, { label: string; className: string }> = {
  positivo: { label: "Positivo", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  neutro: { label: "Neutro", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  negativo: { label: "Negativo", className: "bg-red-500/15 text-red-400 border-red-500/30" },
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const s = sentiment?.toLowerCase() ?? "neutro";
  const config = SENTIMENT_CONFIG[s] ?? SENTIMENT_CONFIG.neutro;
  return (
    <span
      className={cn(
        "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ReunioesClient({ profile, initialSummaries }: ReunioesClientProps) {
  const [summaries, setSummaries] = useState<MeetingSummary[]>(initialSummaries);
  const [selectedSummary, setSelectedSummary] = useState<MeetingSummary | null>(null);
  const [generatedResult, setGeneratedResult] = useState<GeneratedResult | null>(null);

  // Form state
  const [title, setTitle] = useState("");
  const [participantsInput, setParticipantsInput] = useState("");
  const [duration, setDuration] = useState("");
  const [transcript, setTranscript] = useState("");

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"new" | "detail">("new");

  const handleGenerate = useCallback(async () => {
    if (!transcript.trim()) {
      setError("Cole a transcrição da reunião antes de gerar o resumo.");
      return;
    }
    if (transcript.trim().length < 100) {
      setError("A transcrição deve ter pelo menos 100 caracteres.");
      return;
    }

    setIsLoading(true);
    setError(null);

    const participants = participantsInput
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/reuniao/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: transcript.trim(),
          title: title.trim() || undefined,
          participants: participants.length > 0 ? participants : undefined,
          duration_minutes: duration ? parseInt(duration, 10) : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Erro ao gerar resumo.");
        return;
      }

      setGeneratedResult(data);

      // Add to local summaries list
      const newSummary: MeetingSummary = {
        id: data.id,
        title: data.title,
        summary: data.summary,
        action_items: data.action_items,
        participants,
        duration_minutes: duration ? parseInt(duration, 10) : null,
        meeting_date: data.meeting_date,
        created_at: data.created_at,
      };
      setSummaries((prev) => [newSummary, ...prev]);
    } catch {
      setError("Falha na conexão. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  }, [transcript, title, participantsInput, duration]);

  const handleCopy = useCallback(async () => {
    if (!generatedResult) return;
    const text = [
      `REUNIÃO: ${generatedResult.title}`,
      `Data: ${formatDate(generatedResult.meeting_date)}`,
      `Sentimento: ${generatedResult.sentiment}`,
      "",
      "RESUMO EXECUTIVO",
      generatedResult.summary,
      "",
      "DECISÕES TOMADAS",
      ...(generatedResult.key_decisions ?? []).map((d) => `• ${d}`),
      "",
      "PRÓXIMOS PASSOS",
      generatedResult.next_steps,
      "",
      "ACTION ITEMS",
      ...(generatedResult.action_items ?? []).map((a, i) => `${i + 1}. ${a}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // clipboard não disponível
    }
  }, [generatedResult]);

  const handleNewMeeting = () => {
    setGeneratedResult(null);
    setTitle("");
    setParticipantsInput("");
    setDuration("");
    setTranscript("");
    setError(null);
    setMode("new");
    setSelectedSummary(null);
  };

  const handleSelectSummary = (summary: MeetingSummary) => {
    setSelectedSummary(summary);
    setGeneratedResult(null);
    setMode("detail");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/reuniao?id=${id}`, { method: "DELETE" });
      setSummaries((prev) => prev.filter((s) => s.id !== id));
      if (selectedSummary?.id === id) {
        setSelectedSummary(null);
        setMode("new");
      }
    } catch {
      // silencioso
    }
  };

  return (
    <div className="flex gap-5 h-[calc(100vh-3.5rem-2.5rem)] animate-fade-in">
      {/* ── LEFT COLUMN — History ── */}
      <div className="w-72 flex-shrink-0 flex flex-col rounded-xl border border-[#C9A84C]/20 bg-[#09081A] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-white/[0.05]">
          <div className="flex items-center gap-2">
            <Video className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-sm font-semibold text-[#F0ECE4]">Reuniões</span>
            <span className="text-[10px] font-bold bg-[#C9A84C]/15 text-[#C9A84C] px-1.5 py-0.5 rounded-full">
              {summaries.length}
            </span>
          </div>
          <button
            onClick={handleNewMeeting}
            className="flex items-center gap-1 text-xs text-[#C9A84C] hover:text-[#E8C97A] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {summaries.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <Video className="w-8 h-8 text-[#7A8FA8]/40" />
              <p className="text-xs text-[#7A8FA8]">Nenhuma reunião ainda</p>
              <p className="text-[10px] text-[#7A8FA8]/60">
                Gere o primeiro resumo com IA
              </p>
            </div>
          )}

          {summaries.map((s) => {
            const isActive =
              (mode === "detail" && selectedSummary?.id === s.id);
            return (
              <button
                key={s.id}
                onClick={() => handleSelectSummary(s)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-lg text-xs transition-all group flex items-start gap-2",
                  isActive
                    ? "bg-[#C9A84C]/15 border border-[#C9A84C]/30"
                    : "hover:bg-[#111F35] border border-transparent"
                )}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "truncate font-medium",
                      isActive ? "text-[#E8C97A]" : "text-[#F0ECE4]"
                    )}
                  >
                    {s.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Calendar className="w-2.5 h-2.5 text-[#7A8FA8]" />
                    <span className="text-[10px] text-[#7A8FA8]">
                      {formatDate(s.meeting_date)}
                    </span>
                    {s.action_items.length > 0 && (
                      <>
                        <span className="text-[#7A8FA8]/40">·</span>
                        <span className="text-[10px] text-[#7A8FA8]">
                          {s.action_items.length} ações
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => handleDelete(s.id, e)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-[#7A8FA8] hover:text-red-400 flex-shrink-0 mt-0.5"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── RIGHT COLUMN ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* DETAIL MODE */}
        {mode === "detail" && selectedSummary && (
          <DetailView summary={selectedSummary} onBack={handleNewMeeting} />
        )}

        {/* NEW MEETING MODE */}
        {mode === "new" && !generatedResult && (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#8B5E1A] flex items-center justify-center shadow-lg shadow-[#C9A84C]/20">
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-[#F0ECE4]">
                  Transcrição de Reunião
                </h1>
                <p className="text-xs text-[#7A8FA8]">
                  Gere resumos estruturados com IA a partir de transcrições
                </p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold tracking-wider text-[#7A8FA8] uppercase mb-1.5">
                    Título da reunião
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ex.: Alinhamento Q2 2026"
                    className="w-full bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-[10px] font-bold tracking-wider text-[#7A8FA8] uppercase mb-1.5">
                    Participantes
                  </label>
                  <input
                    type="text"
                    value={participantsInput}
                    onChange={(e) => setParticipantsInput(e.target.value)}
                    placeholder="João, Maria, Pedro..."
                    className="w-full bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold tracking-wider text-[#7A8FA8] uppercase mb-1.5">
                    Duração (min)
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="60"
                    min={1}
                    max={480}
                    className="w-full bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold tracking-wider text-[#7A8FA8] uppercase mb-1.5">
                  Transcrição da reunião
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Cole a transcrição da reunião aqui..."
                  rows={12}
                  className="w-full bg-[#111F35] border border-[#243A66] rounded-lg px-3 py-2.5 text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/50 transition-colors resize-none"
                />
                <p className="mt-1.5 text-[10px] text-[#7A8FA8]">
                  Funciona com transcrições do Google Meet, Zoom, Teams ou qualquer texto
                  {transcript.length > 0 && (
                    <span className="ml-2 text-[#C9A84C]">
                      {transcript.length.toLocaleString("pt-BR")} / 50.000 chars
                    </span>
                  )}
                </p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-white/[0.05]">
              <button
                onClick={handleGenerate}
                disabled={isLoading || !transcript.trim()}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#09081A] text-sm font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-[#C9A84C]/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analisando reunião...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar Resumo com IA
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* RESULT MODE */}
        {mode === "new" && generatedResult && (
          <ResultView
            result={generatedResult}
            onCopy={handleCopy}
            copied={copied}
            onNew={handleNewMeeting}
          />
        )}
      </div>
    </div>
  );
}

// ── Detail View ──────────────────────────────────────────────────────────────
function DetailView({
  summary,
  onBack,
}: {
  summary: MeetingSummary;
  onBack: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = [
      `REUNIÃO: ${summary.title}`,
      `Data: ${formatDate(summary.meeting_date)}`,
      "",
      "RESUMO EXECUTIVO",
      summary.summary,
      "",
      "ACTION ITEMS",
      ...summary.action_items.map((a, i) => `${i + 1}. ${a}`),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            Voltar
          </button>
          <span className="text-[#7A8FA8]/30">/</span>
          <h1 className="text-sm font-semibold text-[#F0ECE4] truncate max-w-xs">
            {summary.title}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#111F35]"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copiado!" : "Copiar"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Meta */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-[#7A8FA8]">
            <Calendar className="w-3.5 h-3.5" />
            {formatDate(summary.meeting_date)}
          </div>
          {summary.duration_minutes && (
            <div className="flex items-center gap-1.5 text-xs text-[#7A8FA8]">
              <Clock className="w-3.5 h-3.5" />
              {summary.duration_minutes} min
            </div>
          )}
          {summary.participants.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-[#7A8FA8]">
              <Users className="w-3.5 h-3.5" />
              {summary.participants.join(", ")}
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <p className="text-[10px] font-bold tracking-wider text-[#C9A84C] uppercase mb-3">
            Resumo Executivo
          </p>
          <p className="text-sm text-[#F0ECE4] leading-relaxed whitespace-pre-line">
            {summary.summary}
          </p>
        </div>

        {/* Action items */}
        {summary.action_items.length > 0 && (
          <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold tracking-wider text-[#C9A84C] uppercase mb-3">
              Action Items
            </p>
            <div className="space-y-2">
              {summary.action_items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded border border-[#C9A84C]/40 flex-shrink-0 mt-0.5 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]/40" />
                  </div>
                  <span className="text-sm text-[#7A8FA8]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Result View ───────────────────────────────────────────────────────────────
function ResultView({
  result,
  onCopy,
  copied,
  onNew,
}: {
  result: GeneratedResult;
  onCopy: () => void;
  copied: boolean;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#F0ECE4]">{result.title}</h1>
            <SentimentBadge sentiment={result.sentiment} />
          </div>
          <p className="text-xs text-[#7A8FA8] mt-0.5">
            {formatDate(result.meeting_date)} · Resumo gerado por IA
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCopy}
            className="flex items-center gap-1.5 text-xs text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors px-3 py-1.5 rounded-lg hover:bg-[#111F35]"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copiado!" : "Copiar resumo"}
          </button>
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 text-xs bg-[#C9A84C]/15 text-[#C9A84C] border border-[#C9A84C]/30 hover:bg-[#C9A84C]/25 transition-colors px-3 py-1.5 rounded-lg font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Nova reunião
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Summary */}
        <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
          <p className="text-[10px] font-bold tracking-wider text-[#C9A84C] uppercase mb-3">
            Resumo Executivo
          </p>
          <p className="text-sm text-[#F0ECE4] leading-relaxed whitespace-pre-line">
            {result.summary}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Key Decisions */}
          {result.key_decisions?.length > 0 && (
            <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
              <p className="text-[10px] font-bold tracking-wider text-[#C9A84C] uppercase mb-3">
                Decisões Tomadas
              </p>
              <div className="space-y-2">
                {result.key_decisions.map((decision, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#C9A84C] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-[#7A8FA8]">{decision}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Next Steps */}
          {result.next_steps && (
            <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
              <p className="text-[10px] font-bold tracking-wider text-[#C9A84C] uppercase mb-3">
                Próximos Passos
              </p>
              <p className="text-sm text-[#7A8FA8] leading-relaxed whitespace-pre-line">
                {result.next_steps}
              </p>
            </div>
          )}
        </div>

        {/* Action Items */}
        {result.action_items?.length > 0 && (
          <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-4">
            <p className="text-[10px] font-bold tracking-wider text-[#C9A84C] uppercase mb-3">
              Action Items
            </p>
            <div className="space-y-2.5">
              {result.action_items.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded border border-[#C9A84C]/40 flex-shrink-0 mt-0.5 flex items-center justify-center bg-[#C9A84C]/05">
                    <span className="text-[9px] font-bold text-[#C9A84C]">{i + 1}</span>
                  </div>
                  <span className="text-sm text-[#F0ECE4]">{item}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
