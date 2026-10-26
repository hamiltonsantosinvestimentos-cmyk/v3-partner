"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquare, ExternalLink } from "lucide-react";

// Histórico do Chat Partners ligado a uma proposta (cartão vinculado, código citado ou aviso
// automático). Aparece na aba Comentários do modal da proposta; só a Mesa recebe dados.

interface Msg { id: string; room_id: string; sender_name: string; sender_role: string; content: string; created_at: string; tipo?: string | null }

export function ChatDaProposta({ proposalId }: { proposalId: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  useEffect(() => {
    let vivo = true;
    fetch(`/api/chat/messages?proposta_id=${proposalId}`)
      .then((r) => (r.ok ? r.json() : { messages: null }))
      .then((j) => { if (vivo) setMsgs(j.messages); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [proposalId]);

  if (!msgs) return null;
  const sala = msgs[0]?.room_id;
  return (
    <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <MessageSquare className="w-3.5 h-3.5" /> Conversas no Chat Partners
        {msgs.length > 0 && <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">{msgs.length}</span>}
      </p>
      {msgs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Nenhuma mensagem do chat ligada a esta proposta. Quando alguém citar o código ou vincular a proposta no chat, aparece aqui.</p>
      ) : (
        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
          {msgs.map((m) => {
            const sistema = m.tipo === "sistema" || m.sender_role === "SYSTEM";
            return (
              <div key={m.id} className={`rounded-lg px-3 py-2 ${sistema ? "border border-[#C9A84C]/25 bg-[#C9A84C]/[.06]" : "bg-background/40"}`}>
                <p className="text-[10px] text-muted-foreground">{m.sender_name} · {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-[11.5px] text-foreground">{m.content}</p>
              </div>
            );
          })}
        </div>
      )}
      {sala && (
        <Link href={`/chat/admin?room=${sala}`} className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
          Abrir conversa <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
