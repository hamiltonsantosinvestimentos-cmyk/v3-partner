"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

const STATUS_CLASSES: Record<Campanha["status"], { label: string; text: string; bg: string; border: string }> = {
  rascunho: { label: "Rascunho",     text: "text-[#7A8FA8]",   bg: "bg-[#243A66]",       border: "border-[#243A66]" },
  enviando: { label: "Enviando...",  text: "text-[#C9A84C]",   bg: "bg-[#C9A84C]/10",    border: "border-[#C9A84C]/40" },
  enviada:  { label: "Enviada",      text: "text-emerald-400", bg: "bg-emerald-400/10",  border: "border-emerald-400/40" },
  pausada:  { label: "Pausada",      text: "text-red-400",     bg: "bg-red-400/10",      border: "border-red-400/40" },
};

const TABS: { key: "editor" | "preview" | "contatos"; label: string }[] = [
  { key: "editor", label: "✏️ Template HTML" },
  { key: "preview", label: "👁 Preview" },
  { key: "contatos", label: "👥 Contatos" },
];

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
      const nomeContato = parts.find(p => p && !emailRegex.test(p) && p.length > 1) ?? "";
      result.push({ email: email.toLowerCase(), nome: nomeContato });
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

  const fmtDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—";

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-5">

      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <p className="text-[#C9A84C] text-[10px] font-bold tracking-[2px] uppercase">SDR</p>
          <h2 className="text-[#F0ECE4] text-lg font-bold">Campanhas de E-mail</h2>
        </div>
        <Button onClick={openNova}>+ Nova Campanha</Button>
      </div>

      {/* Resultado do último disparo */}
      {disparoResult && (
        <div className="mb-4 px-4 py-3 bg-emerald-400/10 border border-emerald-400/40 rounded-xl flex gap-4 items-center">
          <span className="text-emerald-400 font-bold">✓ Disparo concluído</span>
          <span className="text-[#7A8FA8] text-[13px]">{disparoResult.enviados} enviados · {disparoResult.erros} erros</span>
          <button onClick={() => setDisparoResult(null)} className="ml-auto text-[#7A8FA8] hover:text-[#F0ECE4] text-lg">×</button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="text-[#7A8FA8] text-center py-16">Carregando...</div>
      ) : campanhas.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">📧</div>
          <p className="text-[#F0ECE4] font-bold text-base mb-2">Nenhuma campanha criada</p>
          <p className="text-[#7A8FA8] text-[13px]">Crie sua primeira campanha de prospecção por e-mail</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {campanhas.map(c => {
            const sb = STATUS_CLASSES[c.status];
            const taxaAbertura = c.total_enviados > 0 ? Math.round((c.total_abertos / c.total_enviados) * 100) : 0;
            return (
              <div key={c.id} className="bg-[#111F35] border border-[#243A66] rounded-xl px-4.5 py-3.5 flex items-center gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#F0ECE4] font-bold text-sm">{c.nome}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${sb.bg} ${sb.text} ${sb.border}`}>
                      {sb.label}
                    </span>
                  </div>
                  <p className="text-[#7A8FA8] text-xs">Assunto: {c.assunto}</p>
                </div>

                {/* Stats */}
                <div className="flex gap-5 shrink-0">
                  <div className="text-center">
                    <div className="text-[#F0ECE4] font-bold text-base">{c.total_contatos}</div>
                    <div className="text-[#7A8FA8] text-[10px]">Contatos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-emerald-400 font-bold text-base">{c.total_enviados}</div>
                    <div className="text-[#7A8FA8] text-[10px]">Enviados</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#C9A84C] font-bold text-base">{taxaAbertura}%</div>
                    <div className="text-[#7A8FA8] text-[10px]">Abertos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[#7A8FA8] font-semibold text-[13px]">{fmtDate(c.enviada_at ?? c.created_at)}</div>
                    <div className="text-[#7A8FA8] text-[10px]">{c.enviada_at ? "Enviada" : "Criada"}</div>
                  </div>
                </div>

                {/* Ações */}
                <div className="flex gap-2 shrink-0">
                  {c.status === "rascunho" && (
                    <>
                      <button
                        onClick={() => openEditar(c)}
                        className="bg-[#162744] border border-[#243A66] rounded-lg px-3 py-1.5 text-[#F0ECE4] text-xs"
                      >
                        Editar
                      </button>
                      <Button
                        onClick={() => handleDisparar(c)}
                        disabled={c.total_contatos === 0 || disparando === c.id}
                        size="sm"
                      >
                        {disparando === c.id ? "Enviando..." : "▶ Disparar"}
                      </Button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(c.id, c.nome)}
                    className="bg-transparent border border-red-400/30 rounded-lg px-2.5 py-1.5 text-red-400 text-xs"
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
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-[900px] w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-[#243A66]">
            <DialogTitle>{editando ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          </DialogHeader>

          {/* Campos base */}
          <div className="px-6 pt-4 flex gap-3">
            <div className="flex-1">
              <label className="text-[#7A8FA8] text-[11px] font-bold uppercase tracking-wide">Nome da Campanha</label>
              <input
                value={nome} onChange={e => setNome(e.target.value)}
                placeholder="Ex: Prospecção Junho 2026"
                className="block w-full mt-1 bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              />
            </div>
            <div className="flex-1">
              <label className="text-[#7A8FA8] text-[11px] font-bold uppercase tracking-wide">Assunto do E-mail</label>
              <input
                value={assunto} onChange={e => setAssunto(e.target.value)}
                placeholder="Ex: Oportunidade exclusiva V3 Partners"
                className="block w-full mt-1 bg-[#162744] border border-[#243A66] rounded-lg px-3 py-2 text-[#F0ECE4] text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 pt-3">
            <div className="flex items-center gap-1 bg-[#0D1929] border border-[#243A66] rounded-xl p-1 w-fit">
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={tab === t.key
                    ? "bg-[#C9A84C] text-[#09081A] px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap"
                    : "text-[#7A8FA8] hover:text-[#F0ECE4] px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap"}
                >
                  {t.key === "contatos" ? `${t.label} ${contatos.length > 0 ? `(${contatos.length})` : ""}` : t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-auto px-6 py-4">
            {tab === "editor" && (
              <div>
                <p className="text-[#7A8FA8] text-xs mb-2">
                  Use <code className="bg-[#162744] px-1.5 py-0.5 rounded text-[#C9A84C]">{`{{nome}}`}</code> e <code className="bg-[#162744] px-1.5 py-0.5 rounded text-[#C9A84C]">{`{{email}}`}</code> para personalizar. O link de opt-out é inserido automaticamente.
                </p>
                <textarea
                  value={templateHtml}
                  onChange={e => setTemplateHtml(e.target.value)}
                  className="w-full h-[380px] bg-[#0D1928] border border-[#243A66] rounded-lg p-3 text-[#F0ECE4] text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                />
              </div>
            )}

            {tab === "preview" && (
              <div className="border border-[#243A66] rounded-lg overflow-hidden bg-white">
                <iframe
                  srcDoc={templateHtml.replace(/\{\{nome\}\}/g, "João Silva").replace(/\{\{email\}\}/g, "joao@exemplo.com")}
                  className="w-full h-[420px] border-none"
                  title="Preview"
                />
              </div>
            )}

            {tab === "contatos" && (
              <div>
                <div className="mb-4 p-4 bg-[#162744] rounded-xl border border-[#243A66]">
                  <p className="text-[#C9A84C] text-[11px] font-bold uppercase tracking-wide mb-2">Importar CSV</p>
                  <p className="text-[#7A8FA8] text-xs mb-3">
                    Formatos aceitos: <code className="text-[#F0ECE4]">email,nome</code> ou apenas <code className="text-[#F0ECE4]">email</code> — um por linha. Cabeçalho opcional.
                  </p>
                  <div className="flex gap-2.5 items-center">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="bg-[#243A66] border border-[#C9A84C] rounded-lg px-4 py-2 text-[#C9A84C] text-xs font-bold"
                    >
                      📂 Selecionar arquivo CSV
                    </button>
                    <span className="text-[#7A8FA8] text-xs">ou cole abaixo</span>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileUpload} />
                  <textarea
                    value={csvText}
                    onChange={e => { setCsvText(e.target.value); parseCsv(e.target.value); }}
                    placeholder={"email,nome\njoao@empresa.com,João Silva\nmaria@empresa.com,Maria Santos"}
                    className="w-full h-[120px] mt-2.5 bg-[#0D1928] border border-[#243A66] rounded-lg p-2.5 text-[#F0ECE4] text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
                  />
                  {csvErro && <p className="text-red-400 text-xs mt-1.5">⚠ {csvErro}</p>}
                </div>

                {contatos.length > 0 && (
                  <div>
                    <p className="text-emerald-400 text-[13px] font-semibold mb-2.5">
                      ✓ {contatos.length} contato{contatos.length !== 1 ? "s" : ""} importado{contatos.length !== 1 ? "s" : ""}
                    </p>
                    <div className="max-h-52 overflow-y-auto bg-[#0D1928] rounded-lg border border-[#243A66]">
                      {contatos.slice(0, 50).map((c, i) => (
                        <div key={i} className="px-3 py-1.5 border-b border-[#162744] flex gap-3 text-xs">
                          <span className="text-[#C9A84C]">{c.email}</span>
                          {c.nome && <span className="text-[#7A8FA8]">{c.nome}</span>}
                        </div>
                      ))}
                      {contatos.length > 50 && (
                        <div className="px-3 py-1.5 text-[#7A8FA8] text-xs">
                          ... e mais {contatos.length - 50} contatos
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {editando && contatos.length === 0 && (
                  <p className="text-[#7A8FA8] text-xs">
                    Importe um CSV apenas se quiser substituir a lista de contatos atual da campanha.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-[#243A66] flex justify-end gap-2.5">
            <button
              onClick={() => setShowModal(false)}
              className="bg-[#162744] border border-[#243A66] rounded-lg px-4.5 py-2 text-[#7A8FA8] text-[13px]"
            >
              Cancelar
            </button>
            <Button onClick={handleSave} disabled={saving || !nome.trim() || !assunto.trim()}>
              {saving ? "Salvando..." : editando ? "Salvar Alterações" : "Criar Campanha"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
