"use client";

import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { DealFormEditorClient } from "@/components/ma/deal-form-editor-client";

type DealComment = { id: string; text: string; author: string; created_at: string };

interface Props {
  dealId: string;
  comments: DealComment[];
  deal: {
    target_company?: string;
    sector?: string;
    location?: string;
    deal_value?: number | null;
    probability_percent?: number | null;
    notes?: string | null;
    stage?: string;
    asset_data?: Record<string, unknown>;
  };
  userName: string;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("pt-BR"); } catch { return iso; }
}

export function DealUpdatesClient({ dealId, comments: initial, deal, userName }: Props) {
  const [comments, setComments] = useState(initial);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  async function addComment() {
    if (!text.trim()) return;
    setSaving(true);
    const comment: DealComment = {
      id: `cmt_${Date.now()}`,
      text: text.trim(),
      author: userName || "M&A",
      created_at: new Date().toISOString(),
    };
    const updated = [...comments, comment];
    await fetch("/api/ma-deals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: dealId, comments: updated }),
    }).catch(() => {});
    setComments(updated);
    setText("");
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Editor completo dos 6 passos ── */}
      <DealFormEditorClient
        dealId={dealId}
        dealData={{
          target_company:      deal.target_company ?? "",
          sector:              deal.sector ?? "",
          location:            deal.location ?? "",
          deal_value:          deal.deal_value ?? null,
          probability_percent: deal.probability_percent ?? null,
          notes:               deal.notes ?? null,
          asset_data:          (deal.asset_data ?? {}) as Parameters<typeof DealFormEditorClient>[0]["dealData"]["asset_data"],
        }}
        compact={false}
      />

      {/* ── Atualizações do Deal ── */}
      <div>
        <p className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex items-center gap-1.5 mb-3">
          <MessageSquare className="w-3 h-3" /> Atualizações do Deal
        </p>
        <div className="space-y-2 max-h-52 overflow-y-auto mb-3">
          {comments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">Nenhuma atualização ainda.</p>
          ) : (
            comments.map(c => (
              <div key={c.id} className="rounded-lg bg-[#162744]/50 border border-[#243A66] p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-[#C9A84C]">{c.author}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(c.created_at)}</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{c.text}</p>
              </div>
            ))
          )}
        </div>
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Adicionar atualização ao deal..."
            rows={2}
            onKeyDown={e => { if (e.key === "Enter" && e.ctrlKey) addComment(); }}
            className="flex-1 rounded-lg border border-[#243A66] bg-[#162744] text-[#F0ECE4] text-xs px-3 py-2 placeholder:text-[#7A8FA8] focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/50 transition resize-none"
          />
          <button
            onClick={addComment}
            disabled={!text.trim() || saving}
            className="rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/40 text-[#C9A84C] px-3 hover:bg-[#C9A84C]/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {saving
              ? <div className="w-3 h-3 border-2 border-[#C9A84C]/40 border-t-[#C9A84C] rounded-full animate-spin" />
              : <Send size={13} />}
          </button>
        </div>
        <p className="text-[10px] text-[#7A8FA8] mt-1">Ctrl+Enter para enviar</p>
      </div>
    </div>
  );
}
