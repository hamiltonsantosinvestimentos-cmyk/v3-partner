"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";

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

const STATUS_LABELS: Record<Campanha["status"], { label: string; color: string }> = {
  rascunho:          { label: "Rascunho",          color: "#7A8FA8" },
  pronta_para_envio: { label: "Pronta p/ envio",   color: "#C9A84C" },
  pausada:           { label: "Pausada",           color: "#F59E0B" },
};

const CONTATO_STATUS: Record<Contato["status"], { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "#60A5FA" },
  invalido: { label: "Inválido", color: "#EF4444" },
  enviado:  { label: "Enviado",  color: "#34D399" },
  erro:     { label: "Erro",     color: "#EF4444" },
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

  async function salvarCampo(campo: "mensagem_template" | "intervalo_segundos" | "status", valor: string | number) {
    if (!selected) return;
    setCampanhas(prev => prev.map(c => c.id === selected.id ? { ...c, [campo]: valor } as Campanha : c));
    await fetch(`/api/sdr/campanhas-whatsapp/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    }).catch(() => {});
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
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* ── Lista de campanhas ── */}
      <div style={{ width: 280, borderRight: "1px solid #243A66", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: 14, borderBottom: "1px solid #243A66" }}>
          <button
            onClick={() => setShowNovaModal(true)}
            style={{
              width: "100%", background: "#C9A84C", border: "none", borderRadius: 8,
              padding: "8px 12px", color: "#09081A", fontWeight: 700, fontSize: 12, cursor: "pointer",
            }}
          >
            + Nova Fila de Envio
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#7A8FA8", fontSize: 12 }}>Carregando...</div>
          ) : campanhas.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#7A8FA8", fontSize: 12 }}>Nenhuma fila criada ainda.</div>
          ) : campanhas.map(c => {
            const st = STATUS_LABELS[c.status];
            return (
              <div
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                style={{
                  padding: "12px 14px", cursor: "pointer",
                  background: selectedId === c.id ? "#162744" : "transparent",
                  borderLeft: selectedId === c.id ? "3px solid #C9A84C" : "3px solid transparent",
                  borderBottom: "1px solid #162744",
                }}
              >
                <div style={{ color: "#F0ECE4", fontWeight: 600, fontSize: 13, marginBottom: 4 }}>{c.nome}</div>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${st.color}20`, color: st.color, textTransform: "uppercase" }}>
                    {st.label}
                  </span>
                  <span style={{ fontSize: 11, color: "#7A8FA8" }}>{c.total_contatos} contato{c.total_contatos !== 1 ? "s" : ""}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Detalhe da campanha ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {!selected ? (
          <div style={{ color: "#7A8FA8", fontSize: 13, textAlign: "center", marginTop: 60 }}>
            Selecione uma fila à esquerda ou crie uma nova.
          </div>
        ) : (
          <div style={{ maxWidth: 780, display: "flex", flexDirection: "column", gap: 18 }}>
            {/* Painel de disparo — envio real via OpenWA */}
            <div style={{
              background: "#111F35", border: "1px solid #243A66", borderRadius: 10,
              padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
            }}>
              <div style={{ fontSize: 12, color: "#7A8FA8", lineHeight: 1.5 }}>
                {selected.status !== "pronta_para_envio" ? (
                  <>Mude o status para <strong style={{ color: "#C9A84C" }}>Pronta p/ envio</strong> para poder disparar.</>
                ) : pendentes === 0 ? (
                  <>Nenhum contato pendente — carregue uma planilha ou aguarde um disparo anterior.</>
                ) : (
                  <><strong style={{ color: "#F0ECE4" }}>{pendentes}</strong> contato{pendentes !== 1 ? "s" : ""} pendente{pendentes !== 1 ? "s" : ""}, um a cada <strong style={{ color: "#F0ECE4" }}>{selected.intervalo_segundos}s</strong>. Envio real via WhatsApp — não dá pra desfazer.</>
                )}
              </div>
              <button
                onClick={dispararFila}
                disabled={disparando || selected.status !== "pronta_para_envio" || pendentes === 0}
                style={{
                  background: disparando ? "#243A66" : "#C9A84C", border: "none", borderRadius: 8,
                  padding: "8px 16px", color: disparando ? "#7A8FA8" : "#09081A", fontWeight: 700, fontSize: 12,
                  cursor: (disparando || selected.status !== "pronta_para_envio" || pendentes === 0) ? "not-allowed" : "pointer",
                  opacity: (selected.status !== "pronta_para_envio" || pendentes === 0) ? 0.5 : 1,
                  flexShrink: 0, whiteSpace: "nowrap",
                }}
              >
                {disparando ? "Disparando..." : "🚀 Disparar"}
              </button>
            </div>
            {disparoResultado && (
              <div style={{ background: "#0F2A1A", border: "1px solid rgba(52,211,153,0.4)", borderRadius: 10, padding: "10px 16px", color: "#34D399", fontSize: 12 }}>
                ✅ {disparoResultado.enviados} enviado{disparoResultado.enviados !== 1 ? "s" : ""}
                {disparoResultado.erros > 0 && <span style={{ color: "#EF4444" }}> · {disparoResultado.erros} com erro</span>}
                {disparoResultado.restantes > 0 && <span> · {disparoResultado.restantes} restante{disparoResultado.restantes !== 1 ? "s" : ""} (clique em Disparar de novo pra continuar)</span>}
              </div>
            )}
            {disparoErro && (
              <div style={{ background: "#2A1414", border: "1px solid rgba(239,68,68,0.4)", borderRadius: 10, padding: "10px 16px", color: "#EF4444", fontSize: 12 }}>
                ⚠️ {disparoErro}
              </div>
            )}

            {/* Nome + status */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ color: "#F0ECE4", fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.nome}</h2>
              <select
                value={selected.status}
                onChange={e => salvarCampo("status", e.target.value)}
                style={{
                  background: `${STATUS_LABELS[selected.status].color}20`, color: STATUS_LABELS[selected.status].color,
                  border: `1px solid ${STATUS_LABELS[selected.status].color}40`, borderRadius: 20,
                  padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", outline: "none",
                }}
              >
                {Object.entries(STATUS_LABELS).map(([v, s]) => (
                  <option key={v} value={v} style={{ background: "#162744", color: "#F0ECE4" }}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* Mensagem template */}
            <div>
              <label style={{ display: "block", color: "#7A8FA8", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                Mensagem (use {"{{nome}}"} para personalizar)
              </label>
              <textarea
                defaultValue={selected.mensagem_template}
                onBlur={e => salvarCampo("mensagem_template", e.target.value)}
                rows={4}
                placeholder="Olá {{nome}}, tudo bem? ..."
                style={{
                  width: "100%", background: "#111F35", border: "1px solid #243A66", borderRadius: 8,
                  padding: 10, color: "#F0ECE4", fontSize: 13, resize: "vertical", outline: "none",
                }}
              />
            </div>

            {/* Mídia (imagem ou vídeo) */}
            <div>
              <label style={{ display: "block", color: "#7A8FA8", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
                Imagem ou vídeo (opcional — a mensagem vira a legenda)
              </label>
              {selected.media_url ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#111F35", border: "1px solid #243A66", borderRadius: 8, padding: 10 }}>
                  {selected.media_type === "video" ? (
                    <video src={selected.media_url} style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} muted />
                  ) : (
                    <img src={selected.media_url} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6 }} />
                  )}
                  <span style={{ flex: 1, color: "#F0ECE4", fontSize: 12 }}>
                    {selected.media_type === "video" ? "🎬 Vídeo anexado" : "🖼️ Imagem anexada"}
                  </span>
                  <button onClick={removerMidia} style={{ background: "#243A66", border: "none", borderRadius: 8, padding: "6px 12px", color: "#7A8FA8", fontSize: 12, cursor: "pointer" }}>
                    Remover
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => midiaInputRef.current?.click()}
                  disabled={uploadingMidia}
                  style={{
                    background: "#162744", border: "1px dashed #243A66", borderRadius: 8,
                    padding: "10px 14px", color: "#7A8FA8", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    width: "100%", opacity: uploadingMidia ? 0.6 : 1,
                  }}
                >
                  {uploadingMidia ? "Enviando..." : "📎 Anexar imagem ou vídeo"}
                </button>
              )}
              <input ref={midiaInputRef} type="file" accept="image/*,video/*" onChange={handleMidiaChange} style={{ display: "none" }} />
              {midiaError && <p style={{ color: "#EF4444", fontSize: 12, marginTop: 6 }}>{midiaError}</p>}
            </div>

            {/* Intervalo */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ color: "#7A8FA8", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>
                Intervalo entre envios
              </label>
              <input
                type="number"
                min={5}
                defaultValue={selected.intervalo_segundos}
                onBlur={e => salvarCampo("intervalo_segundos", Math.max(5, parseInt(e.target.value) || 30))}
                style={{
                  width: 80, background: "#111F35", border: "1px solid #243A66", borderRadius: 8,
                  padding: "6px 10px", color: "#F0ECE4", fontSize: 13, outline: "none",
                }}
              />
              <span style={{ color: "#7A8FA8", fontSize: 12 }}>segundos</span>
            </div>

            {/* Upload */}
            <div style={{ borderTop: "1px solid #243A66", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 13 }}>
                  Contatos na fila ({contatos.length})
                </span>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    background: "#162744", border: "1px solid #C9A84C", borderRadius: 8,
                    padding: "6px 14px", color: "#C9A84C", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  📎 Carregar Excel (.xlsx, .csv)
                </button>
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} style={{ display: "none" }} />
              </div>
              {parseError && <p style={{ color: "#EF4444", fontSize: 12 }}>{parseError}</p>}

              {/* Preview antes de confirmar */}
              {preview && (
                <div style={{ background: "#111F35", border: "1px solid #243A66", borderRadius: 10, padding: 14, marginBottom: 12 }}>
                  <p style={{ color: "#F0ECE4", fontSize: 12, marginBottom: 8 }}>
                    {preview.length} linha{preview.length !== 1 ? "s" : ""} lida{preview.length !== 1 ? "s" : ""} —{" "}
                    <span style={{ color: "#34D399" }}>{validosNoPreview} válido{validosNoPreview !== 1 ? "s" : ""}</span>
                    {preview.length - validosNoPreview > 0 && (
                      <span style={{ color: "#EF4444" }}> · {preview.length - validosNoPreview} inválido{preview.length - validosNoPreview !== 1 ? "s" : ""}</span>
                    )}
                  </p>
                  <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 10 }}>
                    {preview.slice(0, 50).map((p, i) => {
                      const valido = isValidPhonePreview(p.phone);
                      return (
                        <div key={i} style={{ display: "flex", gap: 10, fontSize: 11, padding: "3px 0", color: valido ? "#F0ECE4" : "#EF4444" }}>
                          <span style={{ width: 140 }}>{p.phone}</span>
                          <span style={{ color: "#7A8FA8" }}>{p.nome ?? "—"}</span>
                        </div>
                      );
                    })}
                    {preview.length > 50 && <p style={{ color: "#7A8FA8", fontSize: 11 }}>+ {preview.length - 50} outras...</p>}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => setPreview(null)} style={{ background: "#243A66", border: "none", borderRadius: 8, padding: "6px 14px", color: "#7A8FA8", fontSize: 12, cursor: "pointer" }}>
                      Cancelar
                    </button>
                    <button onClick={confirmarUpload} disabled={uploading} style={{ background: "#C9A84C", border: "none", borderRadius: 8, padding: "6px 14px", color: "#09081A", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
                      {uploading ? "Adicionando..." : `Adicionar ${preview.length} à fila`}
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de contatos já na fila */}
              <div style={{ maxHeight: 320, overflowY: "auto" }}>
                {contatos.length === 0 ? (
                  <p style={{ color: "#7A8FA8", fontSize: 12, textAlign: "center", padding: 16 }}>Nenhum contato carregado ainda.</p>
                ) : contatos.map(c => {
                  const cs = CONTATO_STATUS[c.status];
                  return (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #162744" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: `${cs.color}20`, color: cs.color, textTransform: "uppercase", flexShrink: 0 }}>
                        {cs.label}
                      </span>
                      <span style={{ color: "#F0ECE4", fontSize: 12, width: 150 }}>{c.phone}</span>
                      <span style={{ color: "#7A8FA8", fontSize: 12, flex: 1 }}>{c.nome ?? "—"}</span>
                      <button onClick={() => removerContato(c.id)} title="Remover" style={{ background: "none", border: "none", color: "#7A8FA8", cursor: "pointer", fontSize: 14 }}>
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
      {showNovaModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 100, zIndex: 90 }}>
          <div style={{ background: "#111F35", border: "1px solid #243A66", borderRadius: 16, padding: 20, width: 360 }}>
            <h3 style={{ color: "#F0ECE4", fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Nova Fila de Envio</h3>
            <input
              autoFocus
              value={novoNome}
              onChange={e => setNovoNome(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") criarCampanha(); }}
              placeholder="Nome da fila (ex: Recrutamento SP - Ago/26)"
              style={{
                width: "100%", background: "#162744", border: "1px solid #243A66", borderRadius: 8,
                padding: "8px 12px", color: "#F0ECE4", fontSize: 13, outline: "none", marginBottom: 14,
              }}
            />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowNovaModal(false)} style={{ background: "#243A66", border: "none", borderRadius: 8, padding: "8px 14px", color: "#7A8FA8", fontSize: 12, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={criarCampanha} disabled={!novoNome.trim()} style={{ background: "#C9A84C", border: "none", borderRadius: 8, padding: "8px 14px", color: "#09081A", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: novoNome.trim() ? 1 : 0.5 }}>
                Criar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
