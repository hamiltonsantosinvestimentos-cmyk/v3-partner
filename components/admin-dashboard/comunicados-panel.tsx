"use client";

import { useState, useEffect } from "react";
import { Send, History, Users, Crown, Shield, ChevronDown, CheckCircle2, AlertCircle, Loader2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type Filtro = "TODOS" | "PRO" | "BASE";
type Historico = {
  id: string;
  assunto: string;
  filtro: string;
  total_destinatarios: number;
  total_enviados: number;
  created_at: string;
};

const FILTROS: { value: Filtro; label: string; icon: React.ReactNode; desc: string }[] = [
  { value: "TODOS", label: "Todos os Partners", icon: <Users className="w-4 h-4" />, desc: "Partner + PRO" },
  { value: "PRO", label: "Apenas PRO", icon: <Crown className="w-4 h-4 text-[#C9A84C]" />, desc: "50% comissão · co-branding" },
  { value: "BASE", label: "Apenas Base", icon: <Shield className="w-4 h-4 text-blue-400" />, desc: "30% comissão" },
];

export function ComunicadosPanel() {
  const [assunto, setAssunto] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [loadingHist, setLoadingHist] = useState(false);
  const [abaSelecionada, setAbaSelecionada] = useState<"enviar" | "historico">("enviar");
  const [filtroOpen, setFiltroOpen] = useState(false);

  const filtroAtual = FILTROS.find(f => f.value === filtro)!;

  async function carregarHistorico() {
    setLoadingHist(true);
    try {
      const res = await fetch("/api/comunicados");
      const data = await res.json();
      setHistorico(data.comunicados ?? []);
    } finally {
      setLoadingHist(false);
    }
  }

  useEffect(() => {
    if (abaSelecionada === "historico") carregarHistorico();
  }, [abaSelecionada]);

  async function handleEnviar() {
    if (!assunto.trim() || !mensagem.trim()) {
      setResult({ ok: false, msg: "Preencha o assunto e a mensagem." });
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const res = await fetch("/api/comunicados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assunto, mensagem, filtro }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ ok: true, msg: `Enviado com sucesso para ${data.enviados} de ${data.total} partners.` });
        setAssunto("");
        setMensagem("");
      } else {
        setResult({ ok: false, msg: data.error ?? "Erro ao enviar." });
      }
    } catch {
      setResult({ ok: false, msg: "Erro de conexão." });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-0">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#C9A84C]" />
            <span className="text-sm font-bold text-[#F0ECE4]">Comunicados aos Partners</span>
          </div>
          {/* Abas */}
          <div className="flex gap-1 bg-[#09081A] rounded-lg p-0.5">
            <button
              onClick={() => setAbaSelecionada("enviar")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
                abaSelecionada === "enviar"
                  ? "bg-[#C9A84C] text-[#09081A]"
                  : "text-[#7A8FA8] hover:text-[#F0ECE4]"
              }`}
            >
              Novo Envio
            </button>
            <button
              onClick={() => setAbaSelecionada("historico")}
              className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                abaSelecionada === "historico"
                  ? "bg-[#C9A84C] text-[#09081A]"
                  : "text-[#7A8FA8] hover:text-[#F0ECE4]"
              }`}
            >
              <History className="w-3 h-3" />
              Histórico
            </button>
          </div>
        </div>

        {/* Aba: Novo Envio */}
        {abaSelecionada === "enviar" && (
          <div className="p-5 space-y-4">

            {/* Seletor de destinatários */}
            <div>
              <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-2">
                Destinatários
              </label>
              <div className="relative">
                <button
                  onClick={() => setFiltroOpen(!filtroOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#09081A] border border-border/40 rounded-lg hover:border-[#C9A84C]/40 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-[#C9A84C]">{filtroAtual.icon}</span>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-[#F0ECE4]">{filtroAtual.label}</p>
                      <p className="text-[10px] text-[#7A8FA8]">{filtroAtual.desc}</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-[#7A8FA8] transition-transform ${filtroOpen ? "rotate-180" : ""}`} />
                </button>

                {filtroOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-[#111F35] border border-border/40 rounded-lg overflow-hidden z-10 shadow-xl">
                    {FILTROS.map(f => (
                      <button
                        key={f.value}
                        onClick={() => { setFiltro(f.value); setFiltroOpen(false); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#162744] transition-colors text-left ${
                          filtro === f.value ? "bg-[#C9A84C]/10 border-l-2 border-[#C9A84C]" : ""
                        }`}
                      >
                        <span className={filtro === f.value ? "text-[#C9A84C]" : "text-[#7A8FA8]"}>{f.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-[#F0ECE4]">{f.label}</p>
                          <p className="text-[10px] text-[#7A8FA8]">{f.desc}</p>
                        </div>
                        {filtro === f.value && <CheckCircle2 className="w-4 h-4 text-[#C9A84C] ml-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Assunto */}
            <div>
              <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-2">
                Assunto do E-mail
              </label>
              <input
                type="text"
                value={assunto}
                onChange={e => setAssunto(e.target.value)}
                placeholder="Ex: Novidades V3 Partners — Maio 2026"
                className="w-full px-4 py-3 bg-[#09081A] border border-border/40 rounded-lg text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/60 transition-colors"
              />
            </div>

            {/* Mensagem */}
            <div>
              <label className="block text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-2">
                Mensagem
              </label>
              <textarea
                value={mensagem}
                onChange={e => setMensagem(e.target.value)}
                placeholder="Escreva aqui o conteúdo do comunicado. Utilize quebras de linha para separar os parágrafos."
                rows={7}
                className="w-full px-4 py-3 bg-[#09081A] border border-border/40 rounded-lg text-sm text-[#F0ECE4] placeholder:text-[#7A8FA8]/50 focus:outline-none focus:border-[#C9A84C]/60 transition-colors resize-none"
              />
              <p className="text-[10px] text-[#7A8FA8] mt-1">{mensagem.length} caracteres</p>
            </div>

            {/* Preview do email */}
            {assunto && mensagem && (
              <div className="bg-[#09081A] border border-[#C9A84C]/20 rounded-lg p-4">
                <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest mb-3">Pré-visualização</p>
                <div className="border-b border-border/30 pb-2 mb-3">
                  <p className="text-[10px] text-[#7A8FA8]">De: <span className="text-[#F0ECE4]">V3 Partners</span></p>
                  <p className="text-[10px] text-[#7A8FA8]">Para: <span className="text-[#F0ECE4]">{filtroAtual.label}</span></p>
                  <p className="text-[10px] text-[#7A8FA8]">Assunto: <span className="text-[#F0ECE4] font-semibold">{assunto}</span></p>
                </div>
                <p className="text-xs text-[#7A8FA8] whitespace-pre-wrap line-clamp-4">{mensagem}</p>
              </div>
            )}

            {/* Feedback */}
            {result && (
              <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                result.ok
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20"
              }`}>
                {result.ok
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />}
                {result.msg}
              </div>
            )}

            {/* Botão enviar */}
            <button
              onClick={handleEnviar}
              disabled={sending || !assunto.trim() || !mensagem.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#09081A] font-bold text-sm rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Enviando...</>
              ) : (
                <><Send className="w-4 h-4" /> Enviar Comunicado</>
              )}
            </button>
          </div>
        )}

        {/* Aba: Histórico */}
        {abaSelecionada === "historico" && (
          <div>
            {loadingHist ? (
              <div className="flex items-center justify-center py-12 gap-2 text-[#7A8FA8]">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Carregando histórico...</span>
              </div>
            ) : historico.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <History className="w-8 h-8 text-[#7A8FA8]/40" />
                <p className="text-sm text-[#7A8FA8]">Nenhum comunicado enviado ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {historico.map(h => (
                  <div key={h.id} className="px-5 py-4 hover:bg-secondary/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#F0ECE4] truncate">{h.assunto}</p>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#C9A84C]/10 text-[#C9A84C] border border-[#C9A84C]/20">
                            {h.filtro}
                          </span>
                          <span className="text-[10px] text-[#7A8FA8]">
                            {h.total_enviados}/{h.total_destinatarios} enviados
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-[#7A8FA8]">
                          {new Date(h.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                        <div className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold ${
                          h.total_enviados === h.total_destinatarios ? "text-emerald-400" : "text-amber-400"
                        }`}>
                          {h.total_enviados === h.total_destinatarios
                            ? <><CheckCircle2 className="w-3 h-3" /> Completo</>
                            : <><AlertCircle className="w-3 h-3" /> Parcial</>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
