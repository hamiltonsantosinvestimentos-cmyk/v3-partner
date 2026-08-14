"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QuickReplyOptionsEditor, DEFAULT_QUICK_REPLY_OPTIONS } from "./quick-reply-options-editor";
import type { QuickReplyOption } from "@/lib/whatsapp/quick-reply";

// ─── Types ──────────────────────────────────────────────────────────────────

type Campanha = {
  id: string;
  nome: string;
  mensagem_template: string;
  intervalo_segundos: number;
  status: "rascunho" | "pronta_para_envio" | "pausada";
  total_contatos: number;
  created_at: string;
  media_url: string | null;
  media_type: "image" | "video" | null;
  quick_reply_options: QuickReplyOption[] | null;
};

type Contato = {
  id: string;
  phone: string;
  nome: string | null;
  status: "pendente" | "invalido" | "enviado" | "erro";
  erro_detalhe: string | null;
};

type ContatoParseado = { phone: string; nome: string | null };

// ─── Helpers ────────────────────────────────────────────────────────────────

const PHONE_KEYS = ["telefone", "phone", "celular", "whatsapp", "numero", "número", "fone", "contato"];
const NAME_KEYS = ["nome", "name", "cliente", "lead"];

async function parseExcelFile(file: File): Promise<ContatoParseado[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });

  return rows
    .map(row => {
      const keys = Object.keys(row);
      const phoneKey = keys.find(k => PHONE_KEYS.includes(k.trim().toLowerCase()));
      const nameKey = keys.find(k => NAME_KEYS.includes(k.trim().toLowerCase()));
      const phoneRaw = phoneKey ? row[phoneKey] : Object.values(row)[0];
      const phone = String(phoneRaw ?? "").trim();
      const nome = nameKey ? (String(row[nameKey] ?? "").trim() || null) : null;
      return { phone, nome };
    })
    .filter(r => r.phone.length > 0);
}

function isValidPhonePreview(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

const STATUS_LABELS: Record<Campanha["status"], { label: string; text: string; bg: string; border: string }> = {
  rascunho:          { label: "Rascunho",        text: "text-[#7A8FA8]", bg: "bg-[#7A8FA8]/10", border: "border-[#7A8FA8]/30" },
  pronta_para_envio: { label: "Pronta p/ envio", text: "text-[#C9A84C]", bg: "bg-[#C9A84C]/10", border: "border-[#C9A84C]/30" },
  pausada:           { label: "Pausada",         text: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" },
};

const CONTATO_STATUS: Record<Contato["status"], { label: string; text: string; bg: string }> = {
  pendente: { label: "Pendente", text: "text-blue-400",    bg: "bg-blue-400/10" },
  invalido: { label: "Inválido", text: "text-red-400",     bg: "bg-red-400/10" },
  enviado:  { label: "Enviado",  text: "text-emerald-400", bg: "bg-emerald-400/10" },
  erro:     { label: "Erro",     text: "text-red-400",     bg: "bg-red-400/10" },
};

// ─── Componente ─────────────────────────────────────────────────────────────

export function CampanhasWhatsappClient() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [showNovaModal, setShowNovaModal] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [preview, setPreview] = useState<ContatoParseado[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [disparando, setDisparando] = useState(false);
  const [disparoResultado, setDisparoResultado] = useState<{ enviados: number; erros: number; restantes: number } | null>(null);
  const [disparoErro, setDisparoErro] = useState<string | null>(null);
  const [uploadingMidia, setUploadingMidia] = useState(false);
  const [midiaError, setMidiaError] = useState<string | null>(null);
  const [qrEnabled, setQrEnabled] = useState(false);
  const [qrDraft, setQrDraft] = useState<QuickReplyOption[]>(DEFAULT_QUICK_REPLY_OPTIONS);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const midiaInputRef = useRef<HTMLInputElement>(null);

  const selected = campanhas.find(c => c.id === selectedId) ?? null;

  const loadCampanhas = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sdr/campanhas-whatsapp").then(r => r.json());
      setCampanhas(res.campanhas ?? []);
    } catch { /* silencioso */ }
    setLoading(false);
  }, []);

  const loadDetalhe = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/sdr/campanhas-whatsapp/${id}`).then(r => r.json());
      setContatos(res.contatos ?? []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { loadCampanhas(); }, [loadCampanhas]);
  useEffect(() => { if (selectedId) loadDetalhe(selectedId); else setContatos([]); }, [selectedId, loadDetalhe]);

  // Reseta o rascunho de opções rápidas ao trocar de campanha (ou ao recarregar a lista)
  useEffect(() => {
    if (selected?.quick_reply_options?.length) {
      setQrEnabled(true);
      setQrDraft(selected.quick_reply_options);
    } else {
      setQrEnabled(false);
      setQrDraft(DEFAULT_QUICK_REPLY_OPTIONS);
    }
  }, [selectedId, campanhas]); // eslint-disable-line react-hooks/exhaustive-deps

  async function criarCampanha() {
    if (!novoNome.trim()) return;
    const res = await fetch("/api/sdr/campanhas-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: novoNome.trim() }),
    }).then(r => r.json());
    setShowNovaModal(false);
    setNovoNome("");
    await loadCampanhas();
    if (res.campanha?.id) setSelectedId(res.campanha.id);
  }

  async function salvarCampo(
    campo: "mensagem_template" | "intervalo_segundos" | "status" | "quick_reply_options",
    valor: string | number | QuickReplyOption[] | null
  ) {
    if (!selected) return;
    setCampanhas(prev => prev.map(c => c.id === selected.id ? { ...c, [campo]: valor } as Campanha : c));
    await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    }).catch(() => {});
  }

  function toggleQuickReply(enabled: boolean) {
    setQrEnabled(enabled);
    if (!enabled) {
      salvarCampo("quick_reply_options", null);
    } else if (!qrDraft.some(o => o.label.trim())) {
      setQrDraft(DEFAULT_QUICK_REPLY_OPTIONS);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError(null);
    try {
      const parsed = await parseExcelFile(file);
      if (parsed.length === 0) {
        setParseError("Nenhum contato encontrado. Verifique se a planilha tem uma coluna de telefone.");
        return;
      }
      setPreview(parsed);
    } catch {
      setParseError("Não foi possível ler o arquivo. Use .xlsx, .xls ou .csv.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmarUpload() {
    if (!selected || !preview) return;
    setUploading(true);
    try {
      await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}/contatos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contatos: preview }),
      });
      setPreview(null);
      await Promise.all([loadCampanhas(), loadDetalhe(selected.id)]);
    } finally {
      setUploading(false);
    }
  }

  async function removerContato(contatoId: string) {
    if (!selected) return;
    setContatos(prev => prev.filter(c => c.id !== contatoId));
    await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}/contatos?contato_id=${contatoId}`, { method: "DELETE" }).catch(() => {});
    await loadCampanhas();
  }

  const validosNoPreview = preview?.filter(p => isValidPhonePreview(p.phone)).length ?? 0;
  const pendentes = contatos.filter(c => c.status === "pendente").length;

  async function dispararFila() {
    if (!selected) return;
    setDisparando(true);
    setDisparoErro(null);
    setDisparoResultado(null);
    try {
      const res = await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}/disparar`, { method: "POST" }).then(r => r.json());
      if (res.error) {
        setDisparoErro(res.error);
      } else {
        setDisparoResultado({ enviados: res.enviados ?? 0, erros: res.erros ?? 0, restantes: res.restantes ?? 0 });
      }
    } catch {
      setDisparoErro("Falha de conexão ao disparar a fila.");
    } finally {
      setDisparando(false);
      await Promise.all([loadCampanhas(), loadDetalhe(selected.id)]);
    }
  }

  async function handleMidiaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selected) return;
    setMidiaError(null);
    setUploadingMidia(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}/media`, {
        method: "POST",
        body: formData,
      }).then(r => r.json());
      if (res.error) setMidiaError(res.error);
      else await loadCampanhas();
    } catch {
      setMidiaError("Falha ao enviar o arquivo.");
    } finally {
      setUploadingMidia(false);
      if (midiaInputRef.current) midiaInputRef.current.value = "";
    }
  }

  async function removerMidia() {
    if (!selected) return;
    await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}/media`, { method: "DELETE" }).catch(() => {});
    await loadCampanhas();
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Lista de campanhas ── */}
      <div className="w-70 border-r border-[#243A66] flex flex-col overflow-hidden" style={{ width: 280 }}>
        <div className="p-3.5 border-b border-[#243A66]">
          <Button onClick={() => setShowNovaModal(true)} size="sm" className="w-full">
            + Nova Fila de Envio
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 text-center text-[#7A8FA8] text-xs">Carregando...</div>
          ) : campanhas.length === 0 ? (
            <div className="p-5 text-center text-[#7A8FA8] text-xs">Nenhuma fila criada ainda.</div>
          ) : campanhas.map(c => {
            const st = STATUS_LABELS[c.status];
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className={`px-3.5 py-3 cursor-pointer border-b border-[#162744] ${selectedId === c.id ? "bg-[#162744] border-l-[3px] border-l-[#C9A84C]" : "border-l-[3px] border-l-transparent hover:bg-[#162744]/50"}`}
              >
                <div className="text-[#F0ECE4] font-semibold text-[13px] mb-1">{c.nome}</div>
                <div className="flex gap-1.5 items-center">
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase border ${st.bg} ${st.text} ${st.border}`}>
                    {st.label}
                  </span>
                  <span className="text-[11px] text-[#7A8FA8]">{c.total_contatos} contato{c.total_contatos !== 1 ? "s" : ""}</span>
                  {c.quick_reply_options?.length ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded border bg-blue-400/10 text-blue-400 border-blue-400/30">
                      Opções
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detalhe da campanha ── */}
      <div className="flex-1 overflow-y-auto p-6">
        {!selected ? (
          <div className="text-[#7A8FA8] text-sm text-center mt-16">
            Selecione uma fila à esquerda ou crie uma nova.
          </div>
        ) : (
          <div className="max-w-3xl flex flex-col gap-4">
            {/* Painel de disparo — envio real via OpenWA */}
            <div className="bg-[#111F35] border border-[#243A66] rounded-xl px-4 py-3.5 flex items-center justify-between gap-3">
              <div className="text-xs text-[#7A8FA8] leading-relaxed">
                {selected.status !== "pronta_para_envio" ? (
                  <>Mude o status para <strong className="text-[#C9A84C]">Pronta p/ envio</strong> para poder disparar.</>
                ) : pendentes === 0 ? (
                  <>Nenhum contato pendente — carregue uma planilha ou aguarde um disparo anterior.</>
                ) : (
                  <><strong className="text-[#F0ECE4]">{pendentes}</strong> contato{pendentes !== 1 ? "s" : ""} pendente{pendentes !== 1 ? "s" : ""}, um a cada <strong className="text-[#F0ECE4]">{selected.intervalo_segundos}s</strong>. Envio real via WhatsApp — não dá pra desfazer.</>
                )}
              </div>
              <Button
                onClick={dispararFila}
                disabled={disparando || selected.status !== "pronta_para_envio" || pendentes === 0}
                size="sm"
                className="shrink-0 whitespace-nowrap"
              >
                {disparando ? "Disparando..." : "🚀 Disparar"}
              </Button>
            </div>
            {disparoResultado && (
              <div className="bg-emerald-950/40 border border-emerald-500/40 rounded-xl px-4 py-2.5 text-emerald-400 text-xs">
                ✅ {disparoResultado.enviados} enviado{disparoResultado.enviados !== 1 ? "s" : ""}
                {disparoResultado.erros > 0 && <span className="text-red-400"> · {disparoResultado.erros} com erro</span>}
                {disparoResultado.restantes > 0 && <span> · {disparoResultado.restantes} restante{disparoResultado.restantes !== 1 ? "s" : ""} (clique em Disparar de novo pra continuar)</span>}
              </div>
            )}
            {disparoErro && (
              <div className="bg-red-950/40 border border-red-500/40 rounded-xl px-4 py-2.5 text-red-400 text-xs">
                ⚠️ {disparoErro}
              </div>
            )}

            {/* Nome + status */}
            <div className="flex justify-between items-center">
              <h2 className="text-[#F0ECE4] text-lg font-bold">{selected.nome}</h2>
              <select
                value={selected.status}
                onChange={e => salvarCampo("status", e.target.value)}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold border focus:outline-none ${STATUS_LABELS[selected.status].bg} ${STATUS_LABELS[selected.status].text} ${STATUS_LABELS[selected.status].border}`}
              >
                {Object.entries(STATUS_LABELS).map(([v, s]) => (
                  <option key={v} value={v} className="bg-[#162744] text-[#F0ECE4]">{s.label}</option>
                ))}
              </select>
            </div>

            {/* Mensagem template */}
            <div>
              <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">
                Mensagem (use {"{{nome}}"} para personalizar)
              </label>
              <textarea
                defaultValue={selected.mensagem_template}
                onBlur={e => salvarCampo("mensagem_template", e.target.value)}
                rows={4}
                placeholder="Olá {{nome}}, tudo bem? ..."
                className="w-full bg-[#111F35] border border-[#243A66] rounded-lg p-2.5 text-[#F0ECE4] text-[13px] resize-y focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              />
            </div>

            {/* Mídia (imagem ou vídeo) */}
            <div>
              <label className="block text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase mb-1.5">
                Imagem ou vídeo (opcional — a mensagem vira a legenda)
              </label>
              {selected.media_url ? (
                <div className="flex items-center gap-2.5 bg-[#111F35] border border-[#243A66] rounded-lg p-2.5">
                  {selected.media_type === "video" ? (
                    <video src={selected.media_url} className="w-16 h-16 object-cover rounded-md" muted />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.media_url} alt="" className="w-16 h-16 object-cover rounded-md" />
                  )}
                  <span className="flex-1 text-[#F0ECE4] text-xs">
                    {selected.media_type === "video" ? "🎬 Vídeo anexado" : "🖼️ Imagem anexada"}
                  </span>
                  <button onClick={removerMidia} className="bg-[#243A66] rounded-lg px-3 py-1.5 text-[#7A8FA8] text-xs">
                    Remover
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => midiaInputRef.current?.click()}
                  disabled={uploadingMidia}
                  className={`bg-[#162744] border border-dashed border-[#243A66] rounded-lg px-3.5 py-2.5 text-[#7A8FA8] text-xs font-semibold w-full ${uploadingMidia ? "opacity-60" : ""}`}
                >
                  {uploadingMidia ? "Enviando..." : "📎 Anexar imagem ou vídeo"}
                </button>
              )}
              <input ref={midiaInputRef} type="file" accept="image/*,video/*" onChange={handleMidiaChange} className="hidden" />
              {midiaError && <p className="text-red-400 text-xs mt-1.5">{midiaError}</p>}
            </div>

            {/* Botões de resposta rápida */}
            <div className="border-t border-[#243A66] pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">
                  Botões de resposta rápida (opcional)
                </label>
                <button
                  onClick={() => toggleQuickReply(!qrEnabled)}
                  className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${qrEnabled ? "bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C]" : "bg-[#111F35] border-[#243A66] text-[#7A8FA8]"}`}
                >
                  {qrEnabled ? "Ativado" : "Desativado"}
                </button>
              </div>
              {qrEnabled && (
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-3 space-y-2">
                  <p className="text-[11px] text-[#7A8FA8]">
                    Anexadas ao final da mensagem em todos os disparos desta fila (o WhatsApp não permite botão nativo fora da API oficial da Meta — o lead responde digitando o número da opção).
                  </p>
                  <QuickReplyOptionsEditor options={qrDraft} onChange={setQrDraft} />
                  <Button size="sm" onClick={() => salvarCampo("quick_reply_options", qrDraft.filter(o => o.label.trim()))}>
                    Salvar opções
                  </Button>
                </div>
              )}
            </div>

            {/* Intervalo */}
            <div className="flex items-center gap-2.5">
              <label className="text-[#7A8FA8] text-[10px] font-bold tracking-wide uppercase">
                Intervalo entre envios
              </label>
              <input
                type="number"
                min={5}
                defaultValue={selected.intervalo_segundos}
                onBlur={e => salvarCampo("intervalo_segundos", Math.max(5, parseInt(e.target.value) || 30))}
                className="w-20 bg-[#111F35] border border-[#243A66] rounded-lg px-2.5 py-1.5 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              />
              <span className="text-[#7A8FA8] text-xs">segundos</span>
            </div>

            {/* Upload */}
            <div className="border-t border-[#243A66] pt-4">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[#F0ECE4] font-bold text-[13px]">
                  Contatos na fila ({contatos.length})
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#162744] border border-[#C9A84C] rounded-lg px-3.5 py-1.5 text-[#C9A84C] text-xs font-semibold"
                >
                  📎 Carregar Excel (.xlsx, .csv)
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              </div>
              {parseError && <p className="text-red-400 text-xs">{parseError}</p>}

              {/* Preview antes de confirmar */}
              {preview && (
                <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-3.5 mb-3">
                  <p className="text-[#F0ECE4] text-xs mb-2">
                    {preview.length} linha{preview.length !== 1 ? "s" : ""} lida{preview.length !== 1 ? "s" : ""} —{" "}
                    <span className="text-emerald-400">{validosNoPreview} válido{validosNoPreview !== 1 ? "s" : ""}</span>
                    {preview.length - validosNoPreview > 0 && (
                      <span className="text-red-400"> · {preview.length - validosNoPreview} inválido{preview.length - validosNoPreview !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                  <div className="max-h-40 overflow-y-auto mb-2.5">
                    {preview.slice(0, 50).map((p, i) => {
                      const valido = isValidPhonePreview(p.phone);
                      return (
                        <div key={i} className={`flex gap-2.5 text-[11px] py-0.5 ${valido ? "text-[#F0ECE4]" : "text-red-400"}`}>
                          <span className="w-36">{p.phone}</span>
                          <span className="text-[#7A8FA8]">{p.nome ?? "—"}</span>
                        </div>
                      );
                    })}
                    {preview.length > 50 && <p className="text-[#7A8FA8] text-[11px]">+ {preview.length - 50} outras...</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setPreview(null)} className="bg-[#243A66] rounded-lg px-3.5 py-1.5 text-[#7A8FA8] text-xs">
                      Cancelar
                    </button>
                    <Button size="sm" onClick={confirmarUpload} disabled={uploading}>
                      {uploading ? "Adicionando..." : `Adicionar ${preview.length} à fila`}
                    </Button>
                  </div>
                </div>
              )}

              {/* Lista de contatos já na fila */}
              <div className="max-h-80 overflow-y-auto">
                {contatos.length === 0 ? (
                  <p className="text-[#7A8FA8] text-xs text-center py-4">Nenhum contato carregado ainda.</p>
                ) : contatos.map(c => {
                  const cs = CONTATO_STATUS[c.status];
                  return (
                    <div key={c.id} className="flex items-center gap-2.5 py-1.5 border-b border-[#162744]">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${cs.bg} ${cs.text}`}>
                        {cs.label}
                      </span>
                      <span className="text-[#F0ECE4] text-xs" style={{ width: 150 }}>{c.phone}</span>
                      <span className="text-[#7A8FA8] text-xs flex-1">{c.nome ?? "—"}</span>
                      <button onClick={() => removerContato(c.id)} title="Remover" className="text-[#7A8FA8] hover:text-red-400 text-sm">
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal nova campanha */}
      <Dialog open={showNovaModal} onOpenChange={setShowNovaModal}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova Fila de Envio</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            value={novoNome}
            onChange={e => setNovoNome(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") criarCampanha(); }}
            placeholder="Nome da fila (ex: Recrutamento SP - Ago/26)"
            className="w-full bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
          />
          <DialogFooter>
            <button onClick={() => setShowNovaModal(false)} className="bg-[#243A66] rounded-lg px-3.5 py-2 text-[#7A8FA8] text-xs">
              Cancelar
            </button>
            <Button size="sm" onClick={criarCampanha} disabled={!novoNome.trim()}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
