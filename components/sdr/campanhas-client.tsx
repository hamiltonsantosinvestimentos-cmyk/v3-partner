"use client";

import { useEffect, useState, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Campanha = {
  id: string;
  nome: string;
  assunto: string;
  template_html: string;
  status: "rascunho" | "enviando" | "enviada" | "pausada";
  total_contatos: number;
  total_enviados: number;
  total_abertos: number;
  created_at: string;
  enviada_at: string | null;
};

type Contato = { email: string; nome: string };

// ─── Template padrão ─────────────────────────────────────────────────────────

const TEMPLATE_PADRAO = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#07101E;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0C1929;border-radius:12px;overflow:hidden;border:1px solid #1B3050;">
    <div style="padding:24px 32px;border-bottom:1px solid #1B3050;background:#07101E;">
      <span style="font-size:16px;font-weight:800;color:#E5B96A;letter-spacing:0.08em;">V3 PARTNERS</span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#C8D4E3;">Olá, {{nome}}!</h2>
      <p style="color:#7A96AF;font-size:14px;line-height:1.7;margin:0 0 20px;">
        Escreva aqui o conteúdo da sua campanha...
      </p>
      <div style="margin-top:28px;">
        <a href="https://app.v3partners.com.br" style="display:inline-block;background:#C4922E;color:#07101E;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:700;font-size:14px;">
          Saiba mais →
        </a>
      </div>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #1B3050;background:#07101E;">
      <p style="margin:0;font-size:11px;color:#7A96AF;">V3 Partners — Boutique de Estruturação Financeira</p>
    </div>
  </div>
</body>
</html>`;

// ─── Component ───────────────────────────────────────────────────────────────

export function CampanhasClient() {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Campanha | null>(null);

  // Form
  const [nome, setNome] = useState("");
  const [assunto, setAssunto] = useState("");
  const [templateHtml, setTemplateHtml] = useState(TEMPLATE_PADRAO);
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [csvText, setCsvText] = useState("");
  const [csvErro, setCsvErro] = useState("");
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<"editor" | "preview" | "contatos">("editor");

  // Disparo
  const [disparando, setDisparando] = useState<string | null>(null);
  const [disparoResult, setDisparoResult] = useState<{ enviados: number; erros: number } | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const fetchCampanhas = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sdr/campanhas");
      const data = await res.json();
      setCampanhas(data.campanhas ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampanhas(); }, []);

  // ── CSV Parser ─────────────────────────────────────────────────────────────
  const parseCsv = (text: string) => {
    setCsvErro("");
    const lines = text.trim().split("\n").filter(l => l.trim());
    if (lines.length === 0) { setCsvErro("Arquivo vazio"); return; }

    const result: Contato[] = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 0; i < lines.length; i++) {
      const parts = lines[i].split(/[,;]/).map(p => p.trim().replace(/^["']|["']$/g, ""));
      // Detecta se primeira linha é cabeçalho
      if (i === 0 && !emailRegex.test(parts[0]) && !emailRegex.test(parts[1] ?? "")) continue;

      const email = parts.find(p => emailRegex.test(p));
      if (!email) continue;
      const nome = parts.find(p => p && !emailRegex.test(p) && p.length > 1) ?? "";
      result.push({ email: email.toLowerCase(), nome });
    }

    if (result.length === 0) {
      setCsvErro("Nenhum e-mail válido encontrado. Formato: email,nome (um por linha)");
      return;
    }
    // Remove duplicatas
    const unique = Array.from(new Map(result.map(c => [c.email, c])).values());
    setContatos(unique);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setCsvText(text);
      parseCsv(text);
    };
    reader.readAsText(file, "UTF-8");
  };

  const openNova = () => {
    setEditando(null);
    setNome(""); setAssunto(""); setTemplateHtml(TEMPLATE_PADRAO);
    setContatos([]); setCsvText(""); setCsvErro("");
    setTab("editor");
    setShowModal(true);
  };

  const openEditar = (c: Campanha) => {
    setEditando(c);
    setNome(c.nome); setAssunto(c.assunto); setTemplateHtml(c.template_html);
    setContatos([]); setCsvText(""); setCsvErro("");
    setTab("editor");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nome.trim() || !assunto.trim()) return;
    setSaving(true);
    try {
      if (editando) {
        await fetch("/api/sdr/campanhas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editando.id, nome, assunto, template_html: templateHtml, ...(contatos.length > 0 ? { contatos } : {}) }),
        });
      } else {
        await fetch("/api/sdr/campanhas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nome, assunto, template_html: templateHtml, contatos }),
        });
      }
      setShowModal(false);
      await fetchCampanhas();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, nomeCamp: string) => {
    if (!confirm(`Excluir a campanha "${nomeCamp}"?`)) return;
    await fetch(`/api/sdr/campanhas?id=${id}`, { method: "DELETE" });
    await fetchCampanhas();
  };

  const handleDisparar = async (campanha: Campanha) => {
    if (!confirm(`Disparar a campanha "${campanha.nome}" para ${campanha.total_contatos} contato(s)?`)) return;
    setDisparando(campanha.id);
    setDisparoResult(null);
    try {
      const res = await fetch(`/api/sdr/campanhas/${campanha.id}/disparar`, { method: "POST" });
      const json = await res.json();
      if (res.ok) {
        setDisparoResult({ enviados: json.enviados, erros: json.erros });
        await fetchCampanhas();
      } else {
        alert(json.error ?? "Erro ao disparar");
      }
    } finally {
      setDisparando(null);
    }
  };

  // ── Status badge ───────────────────────────────────────────────────────────
  const statusBadge = (status: Campanha["status"]) => {
    const map = {
      rascunho: { label: "Rascunho", color: "#7A8FA8", bg: "#243A66" },
      enviando: { label: "Enviando...", color: "#C9A84C", bg: "#C9A84C15" },
      enviada:  { label: "Enviada", color: "#4ade80", bg: "#4ade8015" },
      pausada:  { label: "Pausada", color: "#f87171", bg: "#f8717115" },
    };
    return map[status] ?? map.rascunho;
  };

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "20px 24px" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <p style={{ color: "#C9A84C", fontSize: 10, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", margin: 0 }}>SDR</p>
          <h2 style={{ color: "#F0ECE4", fontSize: 18, fontWeight: 700, margin: 0 }}>Campanhas de E-mail</h2>
        </div>
        <button
          onClick={openNova}
          style={{
            background: "#C9A84C", border: "none", borderRadius: 10,
            padding: "9px 20px", color: "#09081A", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          + Nova Campanha
        </button>
      </div>

      {/* Resultado do último disparo */}
      {disparoResult && (
        <div style={{ marginBottom: 16, padding: "12px 16px", background: "#4ade8015", border: "1px solid #4ade8040", borderRadius: 10, display: "flex", gap: 16, alignItems: "center" }}>
          <span style={{ color: "#4ade80", fontWeight: 700 }}>✓ Disparo concluído</span>
          <span style={{ color: "#7A8FA8", fontSize: 13 }}>{disparoResult.enviados} enviados · {disparoResult.erros} erros</span>
          <button onClick={() => setDisparoResult(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#7A8FA8", cursor: "pointer", fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div style={{ color: "#7A8FA8", textAlign: "center", padding: 60 }}>Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📧</div>
          <p style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 16, margin: "0 0 8px" }}>Nenhuma campanha criada</p>
          <p style={{ color: "#7A8FA8", fontSize: 13 }}>Crie sua primeira campanha de prospecção por e-mail</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {campanhas.map(c => {
            const sb = statusBadge(c.status);
            const taxaAbertura = c.total_enviados > 0 ? Math.round((c.total_abertos / c.total_enviados) * 100) : 0;
            return (
              <div key={c.id} style={{
                background: "#111F35", border: "1px solid #243A66", borderRadius: 12,
                padding: "14px 18px", display: "flex", alignItems: "center", gap: 16,
              }}>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 14 }}>{c.nome}</span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                      background: sb.bg, color: sb.color, border: `1px solid ${sb.color}40`,
                    }}>
                      {sb.label}
                    </span>
                  </div>
                  <p style={{ color: "#7A8FA8", fontSize: 12, margin: 0 }}>Assunto: {c.assunto}</p>
                </div>

                {/* Stats */}
                <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 16 }}>{c.total_contatos}</div>
                    <div style={{ color: "#7A8FA8", fontSize: 10 }}>Contatos</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#4ade80", fontWeight: 700, fontSize: 16 }}>{c.total_enviados}</div>
                    <div style={{ color: "#7A8FA8", fontSize: 10 }}>Enviados</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#C9A84C", fontWeight: 700, fontSize: 16 }}>{taxaAbertura}%</div>
                    <div style={{ color: "#7A8FA8", fontSize: 10 }}>Abertos</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#7A8FA8", fontWeight: 600, fontSize: 13 }}>{fmtDate(c.enviada_at ?? c.created_at)}</div>
                    <div style={{ color: "#7A8FA8", fontSize: 10 }}>{c.enviada_at ? "Enviada" : "Criada"}</div>
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                  {c.status === "rascunho" && (
                    <>
                      <button
                        onClick={() => openEditar(c)}
                        style={{ background: "#162744", border: "1px solid #243A66", borderRadius: 8, padding: "6px 12px", color: "#F0ECE4", fontSize: 12, cursor: "pointer" }}
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDisparar(c)}
                        disabled={c.total_contatos === 0 || disparando === c.id}
                        style={{
                          background: c.total_contatos === 0 ? "#243A66" : "#C9A84C",
                          border: "none", borderRadius: 8, padding: "6px 14px",
                          color: c.total_contatos === 0 ? "#7A8FA8" : "#09081A",
                          fontSize: 12, fontWeight: 700, cursor: c.total_contatos === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        {disparando === c.id ? "Enviando..." : "▶ Disparar"}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(c.id, c.nome)}
                    style={{ background: "none", border: "1px solid #f8717130", borderRadius: 8, padding: "6px 10px", color: "#f87171", fontSize: 12, cursor: "pointer" }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal Criar/Editar ──────────────────────────────────────────────── */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "#09081Aee", display: "flex", alignItems: "center", justifyContent: "center",
        }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div style={{
            width: "min(900px, 95vw)", maxHeight: "90vh",
            background: "#111F35", border: "1px solid #243A66", borderRadius: 16,
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            {/* Modal header */}
            <div style={{ padding: "16px 24px", borderBottom: "1px solid #243A66", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ color: "#F0ECE4", fontWeight: 700, fontSize: 16, margin: 0 }}>
                {editando ? "Editar Campanha" : "Nova Campanha"}
              </h3>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", color: "#7A8FA8", fontSize: 20, cursor: "pointer" }}>×</button>
            </div>

            {/* Campos base */}
            <div style={{ padding: "16px 24px 0", display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: "#7A8FA8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Nome da Campanha</label>
                <input
                  value={nome} onChange={e => setNome(e.target.value)}
                  placeholder="Ex: Prospecção Junho 2026"
                  style={{ display: "block", width: "100%", marginTop: 4, background: "#162744", border: "1px solid #243A66", borderRadius: 8, padding: "8px 12px", color: "#F0ECE4", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: "#7A8FA8", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Assunto do E-mail</label>
                <input
                  value={assunto} onChange={e => setAssunto(e.target.value)}
                  placeholder="Ex: Oportunidade exclusiva V3 Partners"
                  style={{ display: "block", width: "100%", marginTop: 4, background: "#162744", border: "1px solid #243A66", borderRadius: 8, padding: "8px 12px", color: "#F0ECE4", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ padding: "12px 24px 0", display: "flex", gap: 4, borderBottom: "1px solid #243A66", marginTop: 12 }}>
              {[{ key: "editor", label: "✏️ Template HTML" }, { key: "preview", label: "👁 Preview" }, { key: "contatos", label: `👥 Contatos ${contatos.length > 0 ? `(${contatos.length})` : ""}` }].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as "editor" | "preview" | "contatos")}
                  style={{
                    background: tab === t.key ? "#162744" : "transparent",
                    border: `1px solid ${tab === t.key ? "#C9A84C" : "transparent"}`,
                    borderBottom: "none", borderRadius: "8px 8px 0 0",
                    padding: "8px 16px", color: tab === t.key ? "#C9A84C" : "#7A8FA8",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ flex: 1, overflow: "auto", padding: "16px 24px" }}>
              {tab === "editor" && (
                <div>
                  <p style={{ color: "#7A8FA8", fontSize: 12, margin: "0 0 8px" }}>
                    Use <code style={{ background: "#162744", padding: "1px 6px", borderRadius: 4, color: "#C9A84C" }}>{`{{nome}}`}</code> e <code style={{ background: "#162744", padding: "1px 6px", borderRadius: 4, color: "#C9A84C" }}>{`{{email}}`}</code> para personalizar. O link de opt-out é inserido automaticamente.
                  </p>
                  <textarea
                    value={templateHtml}
                    onChange={e => setTemplateHtml(e.target.value)}
                    style={{
                      width: "100%", height: 380, background: "#0D1928", border: "1px solid #243A66",
                      borderRadius: 8, padding: 12, color: "#F0ECE4", fontSize: 12,
                      fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {tab === "preview" && (
                <div style={{ border: "1px solid #243A66", borderRadius: 8, overflow: "hidden", background: "#fff" }}>
                  <iframe
                    srcDoc={templateHtml.replace(/\{\{nome\}\}/g, "João Silva").replace(/\{\{email\}\}/g, "joao@exemplo.com")}
                    style={{ width: "100%", height: 420, border: "none" }}
                    title="Preview"
                  />
                </div>
              )}

              {tab === "contatos" && (
                <div>
                  <div style={{ marginBottom: 16, padding: 16, background: "#162744", borderRadius: 10, border: "1px solid #243A66" }}>
                    <p style={{ color: "#C9A84C", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 8px" }}>Importar CSV</p>
                    <p style={{ color: "#7A8FA8", fontSize: 12, margin: "0 0 12px" }}>
                      Formatos aceitos: <code style={{ color: "#F0ECE4" }}>email,nome</code> ou apenas <code style={{ color: "#F0ECE4" }}>email</code> — um por linha. Cabeçalho opcional.
                    </p>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <button
                        onClick={() => fileRef.current?.click()}
                        style={{ background: "#243A66", border: "1px solid #C9A84C", borderRadius: 8, padding: "8px 16px", color: "#C9A84C", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        📂 Selecionar arquivo CSV
                      </button>
                      <span style={{ color: "#7A8FA8", fontSize: 12 }}>ou cole abaixo</span>
                    </div>
                    <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display: "none" }} onChange={handleFileUpload} />
                    <textarea
                      value={csvText}
                      onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value); }}
                      placeholder={"email,nome\njoao@empresa.com,João Silva\nmaria@empresa.com,Maria Santos"}
                      style={{
                        width: "100%", height: 120, marginTop: 10, background: "#0D1928",
                        border: "1px solid #243A66", borderRadius: 8, padding: 10,
                        color: "#F0ECE4", fontSize: 12, fontFamily: "monospace", outline: "none",
                        resize: "vertical", boxSizing: "border-box",
                      }}
                    />
                    {csvErro && <p style={{ color: "#f87171", fontSize: 12, margin: "6px 0 0" }}>⚠ {csvErro}</p>}
                  </div>

                  {contatos.length > 0 && (
                    <div>
                      <p style={{ color: "#4ade80", fontSize: 13, fontWeight: 600, margin: "0 0 10px" }}>
                        ✓ {contatos.length} contato{contatos.length !== 1 ? "s" : ""} importado{contatos.length !== 1 ? "s" : ""}
                      </p>
                      <div style={{ maxHeight: 200, overflowY: "auto", background: "#0D1928", borderRadius: 8, border: "1px solid #243A66" }}>
                        {contatos.slice(0, 50).map((c, i) => (
                          <div key={i} style={{ padding: "6px 12px", borderBottom: "1px solid #162744", display: "flex", gap: 12, fontSize: 12 }}>
                            <span style={{ color: "#C9A84C" }}>{c.email}</span>
                            {c.nome && <span style={{ color: "#7A8FA8" }}>{c.nome}</span>}
                          </div>
                        ))}
                        {contatos.length > 50 && (
                          <div style={{ padding: "6px 12px", color: "#7A8FA8", fontSize: 12 }}>
                            ... e mais {contatos.length - 50} contatos
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {editando && contatos.length === 0 && (
                    <p style={{ color: "#7A8FA8", fontSize: 12 }}>
                      Importe um CSV apenas se quiser substituir a lista de contatos atual da campanha.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: "1px solid #243A66", display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: "#162744", border: "1px solid #243A66", borderRadius: 8, padding: "8px 18px", color: "#7A8FA8", fontSize: 13, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !nome.trim() || !assunto.trim()}
                style={{
                  background: saving || !nome.trim() || !assunto.trim() ? "#243A66" : "#C9A84C",
                  border: "none", borderRadius: 8, padding: "8px 22px",
                  color: saving || !nome.trim() || !assunto.trim() ? "#7A8FA8" : "#09081A",
                  fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}
              >
                {saving ? "Salvando..." : editando ? "Salvar Alterações" : "Criar Campanha"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
