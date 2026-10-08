"use client";
import { confirmar } from "@/lib/aviso";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, PenLine, Send, ExternalLink, Lock } from "lucide-react";
import type { EstadoParecer } from "@/lib/analise-estruturada/parecer";

// Parecer da Análise Estruturada V3 no detalhe do pedido (Mesa): rascunho → assinatura do
// analista → entrega ao cliente. A entrega fica travada até o jurídico validar o termo.

type Veredito = EstadoParecer["veredito"];
const VEREDITOS: Array<{ id: Veredito; nome: string }> = [
  { id: "apto", nome: "Apto para o mercado de crédito" },
  { id: "apto_com_ressalvas", nome: "Apto com ressalvas" },
  { id: "nao_apto", nome: "Ainda não apto" },
];
const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

interface Resposta { estado: EstadoParecer | null; pdf: string | null; termoValidado: boolean; error?: string }

export function ParecerAnaliseEstruturada({ orderId }: { orderId: string }) {
  const [ativo, setAtivo] = useState(false);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [veredito, setVeredito] = useState<Veredito | "">("");
  const [comentario, setComentario] = useState("");
  const [acao, setAcao] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");

  const carregar = useCallback(async () => {
    try {
      const [rp, rd] = await Promise.all([
        fetch(`/api/analise-estruturada/pedido/${orderId}`).then((r) => r.json()),
        fetch(`/api/analise-estruturada/pedido/${orderId}/parecer`).then((r) => r.json() as Promise<Resposta>),
      ]);
      setAtivo(!!rp?.ativo);
      setDados(rd);
      if (rd.estado) { setVeredito(rd.estado.veredito); setComentario(rd.estado.comentario ?? ""); }
    } catch { setAtivo(false); }
  }, [orderId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function executar(tipo: "gerar" | "assinar" | "entregar") {
    if (tipo === "entregar" && !await confirmar("Enviar o parecer assinado para o e-mail do cliente e marcar o pedido como entregue?")) return;
    setAcao(tipo); setErro(""); setAviso("");
    try {
      const r = await fetch(`/api/analise-estruturada/pedido/${orderId}/parecer`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: tipo, veredito: veredito || undefined, comentario }),
      });
      const d = await r.json() as Resposta;
      if (!r.ok) throw new Error(d.error ?? "Falha.");
      setDados(d);
      if (d.estado) setVeredito(d.estado.veredito);
      setAviso(tipo === "gerar" ? "Rascunho gerado." : tipo === "assinar" ? "Parecer assinado." : "Parecer entregue ao cliente.");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setAcao(null);
    }
  }

  if (!ativo) return null;
  const estado = dados?.estado ?? null;
  const entregue = estado?.status === "entregue";
  const sugerido = estado?.vereditoSugerido ? VEREDITOS.find((v) => v.id === estado.vereditoSugerido)?.nome : null;

  return (
    <div className="rounded-xl border border-[#C9A84C]/30 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Análise Estruturada V3 · parecer</p>
          <p className="text-sm font-semibold text-foreground">
            {!estado ? "Ainda não gerado"
              : estado.status === "rascunho" ? `Rascunho gerado em ${fmt(estado.geradoEm)}`
              : estado.status === "assinado" ? `Assinado por ${estado.assinadoPor} em ${fmt(estado.assinadoEm!)}`
              : `Entregue em ${fmt(estado.entregueEm!)} por ${estado.entreguePor}`}
          </p>
        </div>
        {dados?.pdf && (
          <a href={dados.pdf} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#E8C97A] hover:underline">
            <FileText className="w-3.5 h-3.5" /> Abrir PDF <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>

      {!dados?.termoValidado && (
        <p className="text-[11px] text-amber-400 inline-flex items-center gap-1">
          <Lock className="w-3 h-3" /> Termo de responsabilidade em minuta: o PDF sai com a tarja MINUTA e a entrega ao cliente fica bloqueada até a validação do jurídico.
        </p>
      )}

      {!entregue && (
        <div className="space-y-2">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Veredito{sugerido ? ` (sugerido pelo cálculo: ${sugerido})` : ""}</label>
            <select value={veredito} onChange={(e) => setVeredito(e.target.value as Veredito)}
              className="mt-1 w-full bg-secondary/40 rounded-lg px-2 py-1.5 text-sm text-foreground border border-border/50">
              <option value="">Escolha o veredito…</option>
              {VEREDITOS.map((v) => <option key={v.id} value={v.id}>{v.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Comentário do analista (vai no resumo do parecer)</label>
            <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} maxLength={1500}
              className="mt-1 w-full bg-secondary/40 rounded-lg px-2 py-1.5 text-sm text-foreground border border-border/50"
              placeholder="Leitura do analista: contexto, mitigantes, estrutura recomendada…" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => executar("gerar")} disabled={!!acao}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C] text-[#E8C97A] text-xs font-bold disabled:opacity-50">
              {acao === "gerar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />} Gerar rascunho
            </button>
            <button onClick={() => executar("assinar")} disabled={!!acao || !veredito}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-50">
              {acao === "assinar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PenLine className="w-3.5 h-3.5" />} Assinar parecer
            </button>
            <button onClick={() => executar("entregar")} disabled={!!acao || estado?.status !== "assinado" || !dados?.termoValidado}
              title={!dados?.termoValidado ? "Aguardando validação jurídica do termo" : estado?.status !== "assinado" ? "Assine o parecer antes" : ""}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-40">
              {acao === "entregar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Entregar ao cliente
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">O parecer usa o último cálculo salvo. Mudou algum número? Recalcule acima e gere de novo.</p>
        </div>
      )}
      {aviso && <p className="text-xs text-[#C9A84C]">{aviso}</p>}
      {erro && <p className="text-xs text-red-400">{erro}</p>}
    </div>
  );
}
