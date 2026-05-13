"use client";

import { useState, useEffect } from "react";
import { ChevronDown, ChevronUp, Search, Briefcase, Loader2, FileText, Check, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Documento {
  id: string;
  nome: string;
  obrigatorio: boolean;
}

export interface PortfolioLinha {
  id: string;
  nome: string;
  descricao: string | null;
  categoria: string | null;
  publico_alvo: string | null;
  prazo_pagamento: string | null;
  taxas: string | null;
  outras_despesas: string | null;
  limite_credito: string | null;
  comprometimento_renda: string | null;
  aporte: string | null;
  amortizacao: string | null;
  perfil_garantia: string | null;
  destinacao: string | null;
  tempo_estruturacao: string | null;
  custo_estruturacao: string | null;
  diferenciais: string | null;
  documentos_pf: Documento[];
  documentos_pj: Documento[];
  ativo: boolean;
  ordem: number;
}

const CAT_COLORS: Record<string, string> = {
  "Imobiliário":    "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Auto":           "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Capital de Giro":"bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Consórcio":      "bg-purple-500/20 text-purple-400 border-purple-500/30",
  "Construção":     "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "Agro":           "bg-lime-500/20 text-lime-400 border-lime-500/30",
  "Internacional":  "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  "Seguros":        "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "M&A":            "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

const FIELDS: { key: keyof PortfolioLinha; label: string }[] = [
  { key: "publico_alvo",        label: "Público-Alvo" },
  { key: "prazo_pagamento",     label: "Prazo de Pagamento" },
  { key: "taxas",               label: "Taxas" },
  { key: "outras_despesas",     label: "Outras Despesas" },
  { key: "limite_credito",      label: "Limite de Crédito" },
  { key: "comprometimento_renda", label: "Comprometimento de Renda" },
  { key: "aporte",              label: "Aporte" },
  { key: "amortizacao",         label: "Amortização" },
  { key: "perfil_garantia",     label: "Perfil da Garantia" },
  { key: "destinacao",          label: "Destinação" },
  { key: "tempo_estruturacao",  label: "Tempo de Estruturação" },
  { key: "custo_estruturacao",  label: "Custo de Estruturação" },
  { key: "diferenciais",        label: "Diferenciais" },
];

// ── PDF Generator ─────────────────────────────────────────────────────────────
async function gerarPDF(linha: PortfolioLinha, docs: Documento[], checados: Set<string>) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const margin = 18;

  // Header background
  doc.setFillColor(9, 8, 26);
  doc.rect(0, 0, W, 52, "F");

  // Logo
  try {
    const logoRes = await fetch("/logo.jpg");
    const logoBlob = await logoRes.blob();
    const logoB64 = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(logoBlob);
    });
    doc.addImage(logoB64, "JPEG", margin, 9, 30, 30);
  } catch { /* logo opcional */ }

  // Product name
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(240, 236, 228);
  doc.text(linha.nome, margin + 36, 26);

  // Category
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(201, 168, 76);
  doc.text((linha.categoria ?? "").toUpperCase(), margin + 36, 33);

  // Subtitle
  doc.setFontSize(7);
  doc.setTextColor(122, 143, 168);
  doc.text("CHECKLIST DE DOCUMENTOS — V3 PARTNERS 2026", margin + 36, 40);

  // Gold separator line
  doc.setFillColor(201, 168, 76);
  doc.rect(0, 52, W, 0.8, "F");

  // Body background
  doc.setFillColor(10, 22, 40);
  doc.rect(0, 52.8, W, 244.2, "F");

  let y = 68;

  const obrig = docs.filter(d => d.obrigatorio);
  const opcion = docs.filter(d => !d.obrigatorio);
  const total = docs.length;
  const done = docs.filter(d => checados.has(d.id)).length;

  function drawSection(title: string, r: number, g: number, b: number, sectionDocs: Documento[]) {
    if (sectionDocs.length === 0) return;

    // Section label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(r, g, b);
    doc.text(title, margin, y);
    y += 2;

    // Underline
    doc.setDrawColor(r, g, b);
    doc.setLineWidth(0.3);
    doc.line(margin, y, W - margin, y);
    y += 8;

    sectionDocs.forEach(d => {
      const checked = checados.has(d.id);

      // Checkbox border
      doc.setDrawColor(201, 168, 76);
      doc.setLineWidth(0.5);
      doc.setFillColor(10, 22, 40);
      doc.rect(margin, y - 3.5, 4, 4, "FD");

      // Checkbox fill
      if (checked) {
        doc.setFillColor(201, 168, 76);
        doc.rect(margin + 0.7, y - 2.8, 2.6, 2.6, "F");
      }

      // Document name
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      if (checked) {
        doc.setTextColor(122, 143, 168);
      } else {
        doc.setTextColor(240, 236, 228);
      }
      doc.text(d.nome, margin + 7, y);

      // Strikethrough for checked items
      if (checked) {
        const textWidth = doc.getTextWidth(d.nome);
        doc.setDrawColor(122, 143, 168);
        doc.setLineWidth(0.3);
        doc.line(margin + 7, y - 0.6, margin + 7 + textWidth, y - 0.6);
      }

      y += 9;

      if (y > 270) {
        doc.addPage();
        doc.setFillColor(10, 22, 40);
        doc.rect(0, 0, W, 297, "F");
        y = 20;
      }
    });

    y += 6;
  }

  drawSection("DOCUMENTOS OBRIGATÓRIOS", 201, 168, 76, obrig);
  drawSection("DOCUMENTOS OPCIONAIS", 122, 143, 168, opcion);

  // Progress summary
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(201, 168, 76);
  doc.text(`${done} de ${total} documentos coletados`, margin, y);
  y += 5;

  // Progress bar background
  doc.setFillColor(27, 48, 80);
  doc.rect(margin, y, W - margin * 2, 3, "F");

  // Progress bar fill
  if (total > 0) {
    const pct = done / total;
    doc.setFillColor(201, 168, 76);
    doc.rect(margin, y, (W - margin * 2) * pct, 3, "F");
  }

  // Footer
  const footerY = 285;
  doc.setFillColor(9, 8, 26);
  doc.rect(0, footerY - 6, W, 18, "F");
  doc.setFillColor(201, 168, 76);
  doc.rect(0, footerY - 6, W, 0.5, "F");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(122, 143, 168);
  doc.text("v3partners.com.br", margin, footerY + 2);
  doc.text(
    "Documento de uso interno — V3 Partners Soluções Ltda",
    W / 2,
    footerY + 2,
    { align: "center" }
  );
  doc.text(
    new Date().toLocaleDateString("pt-BR"),
    W - margin,
    footerY + 2,
    { align: "right" }
  );

  doc.save(`checklist-${linha.nome.toLowerCase().replace(/[\s/]+/g, "-")}.pdf`);
}

// ── Documentos Checklist ──────────────────────────────────────────────────────
function DocumentosChecklist({ linha }: { linha: PortfolioLinha }) {
  const [pessoa, setPessoa] = useState<"PF" | "PJ">("PF");

  const docs = pessoa === "PF" ? (linha.documentos_pf ?? []) : (linha.documentos_pj ?? []);
  const LS_KEY = `v3_docs_${linha.id}_${pessoa}`;

  const [checados, setChecados] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try { return new Set(JSON.parse(localStorage.getItem(`v3_docs_${linha.id}_PF`) ?? "[]") as string[]); }
    catch { return new Set<string>(); }
  });
  const [gerando, setGerando] = useState(false);

  // Reload checados from localStorage whenever pessoa tab changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setChecados(new Set(JSON.parse(localStorage.getItem(LS_KEY) ?? "[]") as string[]));
    } catch {
      setChecados(new Set<string>());
    }
  }, [pessoa, LS_KEY]);

  const obrig = docs.filter(d => d.obrigatorio);
  const opcion = docs.filter(d => !d.obrigatorio);
  const total = docs.length;
  const done = docs.filter(d => checados.has(d.id)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function toggle(id: string) {
    setChecados(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])); } catch { /* noop */ }
      return next;
    });
  }

  async function handlePDF() {
    setGerando(true);
    try { await gerarPDF(linha, docs, checados); } finally { setGerando(false); }
  }

  const totalDocs = (linha.documentos_pf ?? []).length + (linha.documentos_pj ?? []).length;

  return (
    <div className="mt-4 pt-4 border-t border-[#1B3050]">
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-[#C9A84C]" />
          <p className="text-[10px] font-bold text-[#C9A84C] uppercase tracking-widest">Checklist de Documentos</p>
          <span className="text-[10px] text-muted-foreground">{done}/{total} coletados</span>
        </div>
        <button
          onClick={handlePDF}
          disabled={gerando || total === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-bold hover:bg-[#C9A84C]/20 transition-all disabled:opacity-50"
        >
          {gerando
            ? <Loader2 className="w-3 h-3 animate-spin" />
            : <Download className="w-3 h-3" />}
          {gerando ? "Gerando…" : "Exportar PDF"}
        </button>
      </div>

      {/* PF / PJ Toggle */}
      <div className="flex gap-1 mb-3">
        {(["PF", "PJ"] as const).map(t => (
          <button key={t} onClick={() => setPessoa(t)}
            className={cn(
              "px-3 py-1 rounded-lg text-[10px] font-bold border transition-all",
              pessoa === t
                ? "bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C]"
                : "border-[#243A66] text-muted-foreground hover:border-[#C9A84C]/30"
            )}
          >{t === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}</button>
        ))}
      </div>

      {docs.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic px-1">
          Nenhum documento cadastrado para {pessoa === "PF" ? "Pessoa Física" : "Pessoa Jurídica"}.
        </p>
      ) : (
        <>
          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-[#1B3050] mb-4 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#C9A84C] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Obrigatórios */}
            {obrig.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-2">Obrigatórios</p>
                <div className="space-y-2">
                  {obrig.map(doc => (
                    <label key={doc.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <div
                        onClick={() => toggle(doc.id)}
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all",
                          checados.has(doc.id)
                            ? "bg-[#C9A84C] border-[#C9A84C]"
                            : "border-[#243A66] bg-[#09081A] group-hover:border-[#C9A84C]/50"
                        )}
                      >
                        {checados.has(doc.id) && (
                          <Check className="w-2.5 h-2.5 text-[#09081A]" strokeWidth={3} />
                        )}
                      </div>
                      <span
                        onClick={() => toggle(doc.id)}
                        className={cn(
                          "text-xs transition-colors select-none",
                          checados.has(doc.id) ? "line-through text-muted-foreground" : "text-[#F0ECE4]"
                        )}
                      >
                        {doc.nome}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Opcionais */}
            {opcion.length > 0 && (
              <div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Opcionais</p>
                <div className="space-y-2">
                  {opcion.map(doc => (
                    <label key={doc.id} className="flex items-center gap-2.5 cursor-pointer group">
                      <div
                        onClick={() => toggle(doc.id)}
                        className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all",
                          checados.has(doc.id)
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-[#243A66] bg-[#09081A] group-hover:border-emerald-500/50"
                        )}
                      >
                        {checados.has(doc.id) && (
                          <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        )}
                      </div>
                      <span
                        onClick={() => toggle(doc.id)}
                        className={cn(
                          "text-xs transition-colors select-none",
                          checados.has(doc.id) ? "line-through text-muted-foreground" : "text-[#7A8FA8]"
                        )}
                      >
                        {doc.nome}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

const NIVEL_CFG: Record<string, { label: string; cls: string }> = {
  NIVEL_1: { label: "N1",  cls: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  NIVEL_2: { label: "N2",  cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  NIVEL_3: { label: "N3",  cls: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
};

function normStr(s: string) {
  return s.toUpperCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Linha Card ─────────────────────────────────────────────────────────────────
function LinhaCard({ linha, nivelMap }: { linha: PortfolioLinha; nivelMap: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const catCls = CAT_COLORS[linha.categoria ?? ""] ?? "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/30";

  const totalDocs = (linha.documentos_pf ?? []).length + (linha.documentos_pj ?? []).length;

  // Match nivel by normalized name (prefix match both ways)
  const nomeNorm = normStr(linha.nome);
  const nivelKey = Object.keys(nivelMap).find(k => {
    return k === nomeNorm || k.startsWith(nomeNorm) || nomeNorm.startsWith(k);
  });
  const nivel = nivelKey ? nivelMap[nivelKey] : null;
  const nivelCfg = nivel ? NIVEL_CFG[nivel] : null;

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-200 overflow-hidden",
      open ? "border-[#C9A84C]/30 bg-[#0C1929]" : "border-[#1B3050] bg-[#0A1628] hover:border-[#243A66]"
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-start gap-4 p-5 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Briefcase className="w-4 h-4 text-[#C9A84C]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-bold text-white">{linha.nome}</p>
            {nivelCfg && (
              <span className={cn("text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide", nivelCfg.cls)}
                title={nivel === "NIVEL_1" ? "Mesa Crédito N1 — Varejo" : nivel === "NIVEL_2" ? "Mesa Crédito N2 — Estruturado" : "Mesa Crédito N3 — High Ticket"}>
                {nivelCfg.label}
              </span>
            )}
            {linha.categoria && (
              <span className={cn("text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide", catCls)}>
                {linha.categoria}
              </span>
            )}
            {totalDocs > 0 && (
              <span className="text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/25 flex items-center gap-1">
                <FileText className="w-2.5 h-2.5" />
                {totalDocs} docs
              </span>
            )}
          </div>
          {linha.descricao && (
            <p className={cn("text-xs text-muted-foreground leading-relaxed line-clamp-2 transition-all", open && "line-clamp-none")}>
              {linha.descricao}
            </p>
          )}
          {/* Preview chips */}
          {!open && (
            <div className="flex flex-wrap gap-2 mt-2">
              {linha.taxas && (
                <span className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">Taxa:</strong> {linha.taxas}
                </span>
              )}
              {linha.aporte && (
                <span className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">Aporte:</strong> {linha.aporte}
                </span>
              )}
              {linha.prazo_pagamento && (
                <span className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">Prazo:</strong> {linha.prazo_pagamento}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-muted-foreground mt-1">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded details */}
      {open && (
        <div className="px-5 pb-5 border-t border-[#1B3050]">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-8 gap-y-0 mt-4">
            {FIELDS.map(({ key, label }) => {
              const val = linha[key] as string | null;
              if (!val) return null;
              return (
                <div key={key} className="py-2.5 border-b border-[#1B3050]/50 last:border-0">
                  <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-0.5">{label}</p>
                  <p className="text-xs text-[#F0ECE4] leading-relaxed">{val}</p>
                </div>
              );
            })}
          </div>

          {/* Checklist de documentos */}
          <DocumentosChecklist linha={linha} />
        </div>
      )}
    </div>
  );
}

export function PortfolioViewer() {
  const [linhas, setLinhas] = useState<PortfolioLinha[]>([]);
  const [nivelMap, setNivelMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState<string>("Todos");

  useEffect(() => {
    Promise.all([
      fetch("/api/portfolio").then(r => r.json()),
      fetch("/api/regras-linhas").then(r => r.json()),
    ]).then(([portfolioData, regrasData]) => {
      setLinhas(portfolioData.linhas ?? []);
      // Build map: normalized nome → nivel
      const map: Record<string, string> = {};
      for (const r of (regrasData.regras ?? [])) {
        if (r.nome && r.nivel) map[normStr(r.nome)] = r.nivel;
      }
      setNivelMap(map);
    }).finally(() => setLoading(false));
  }, []);

  const categorias = ["Todos", ...Array.from(new Set(linhas.map(l => l.categoria).filter(Boolean) as string[]))];

  const filtered = linhas.filter(l => {
    const matchCat = catFilter === "Todos" || l.categoria === catFilter;
    const matchSearch = !search || l.nome.toLowerCase().includes(search.toLowerCase()) || (l.descricao ?? "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Carregando portfólio…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar produto…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-[#243A66] bg-[#111F35] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/50"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categorias.map(cat => (
            <button
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all",
                catFilter === cat
                  ? "bg-[#C9A84C] text-[#09081A] border-[#C9A84C]"
                  : "bg-[#111F35] text-muted-foreground border-[#243A66] hover:border-[#C9A84C]/40"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
        {filtered.length} produto{filtered.length !== 1 ? "s" : ""} — PORTFÓLIO V3 PARTNERS 2026
      </p>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-32 text-muted-foreground gap-2">
          <Briefcase className="w-8 h-8 opacity-20" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(l => <LinhaCard key={l.id} linha={l} nivelMap={nivelMap} />)}
        </div>
      )}
    </div>
  );
}
