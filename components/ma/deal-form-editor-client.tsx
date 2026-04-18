"use client";

import { useState } from "react";
import { Pencil, X, Check, Loader2, ChevronDown, ChevronUp } from "lucide-react";

// ── Constantes ────────────────────────────────────────────────────────────────

const SETORES = [
  "Fintech", "Crédito Estruturado", "Real Estate", "Mineração · Pedras Preciosas",
  "Mineração · Metais", "Agropecuária", "Infraestrutura", "Asset Management",
  "Corretagem", "Seguros", "Saúde", "Educação", "Varejo", "Indústria", "Outro",
];

const TIPOS_DEAL = [
  "Venda Total (100%)", "Venda Parcial", "Joint Venture",
  "Captação de Capital", "Fusão", "Aquisição Estratégica",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls = "w-full rounded-lg border border-[#243A66] bg-[#111F35] text-[#F0ECE4] text-xs px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 transition placeholder:text-[#7A8FA8]";
const labelCls = "text-[10px] font-semibold text-[#7A8FA8] uppercase tracking-wider mb-1 block";
const sectionCls = "rounded-xl border border-[#243A66] overflow-hidden";
const sectionHeaderCls = "flex items-center justify-between px-4 py-2.5 bg-[#162744]/60 cursor-pointer select-none";
const sectionTitleCls = "text-[10px] font-bold tracking-widest uppercase text-[#C9A84C]";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AssetData {
  tipo_participante?: string;
  tipoOperacao?: string;
  cnpj?: string;
  founding_year?: string;
  descricao_ptbr?: string;
  produtos_servicos?: string;
  diferenciais?: string[];
  tese_investimento?: string;
  mercado_atendido?: string;
  financeiro?: {
    receita?: Record<string, string>;
    ebitda?: Record<string, string>;
    lucro?: Record<string, string>;
  };
  divida_total?: string;
  juridico?: {
    licencas?: string;
    tem_processos?: boolean;
    detalhes_processos?: string;
    tem_pendencias?: boolean;
  };
  contato?: { nome?: string; email?: string; telefone?: string };
  comissionamento?: string;
  info_adicionais?: string;
  [key: string]: unknown;
}

export interface DealFormEditorProps {
  dealId: string;
  dealData: {
    target_company: string;
    sector: string;
    location: string;
    deal_value: number | null;
    probability_percent: number | null;
    notes: string | null;
    asset_data: AssetData;
  };
  onSaved?: (updated: { target_company: string; sector: string; location: string; deal_value: number | null; notes: string | null; asset_data: AssetData }) => void;
  compact?: boolean; // true = estilo modal (Mesa M&A), false = estilo página (M&A)
}

// ── Componente principal ──────────────────────────────────────────────────────

export function DealFormEditorClient({ dealId, dealData, onSaved, compact = false }: DealFormEditorProps) {
  const ad = dealData.asset_data ?? {};
  const fin = ad.financeiro;
  const jur = ad.juridico;
  const ct = ad.contato;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quais seções estão abertas no accordion
  const [open, setOpen] = useState({ s1: true, s2: true, s3: true, s4: true, s5: true });
  const toggle = (k: keyof typeof open) => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── Step 1 — Identificação ──
  const [s1, setS1] = useState({
    target_company:    dealData.target_company ?? "",
    tipo_participante: String(ad.tipo_participante ?? "Vendedor"),
    sector:            dealData.sector ?? "",
    tipoOperacao:      String(ad.tipoOperacao ?? ""),
    location:          dealData.location ?? "",
    cnpj:              String(ad.cnpj ?? ""),
    founding_year:     String(ad.founding_year ?? ""),
  });

  // ── Step 2 — Descrição ──
  const [s2, setS2] = useState({
    descricao_ptbr:    String(ad.descricao_ptbr ?? ""),
    produtos_servicos: String(ad.produtos_servicos ?? ""),
    diferenciais:      Array.isArray(ad.diferenciais) ? (ad.diferenciais as string[]).join("\n") : String(ad.tese_investimento ?? ""),
    mercado_atendido:  String(ad.mercado_atendido ?? ""),
  });

  // ── Step 3 — Financeiro ──
  const [s3, setS3] = useState({
    deal_value:   dealData.deal_value ? String(dealData.deal_value) : "",
    divida_total: String(ad.divida_total ?? ""),
    r2023: fin?.receita?.["2023"] ?? "", r2024: fin?.receita?.["2024"] ?? "", r2025: fin?.receita?.["2025"] ?? "",
    e2023: fin?.ebitda?.["2023"]  ?? "", e2024: fin?.ebitda?.["2024"]  ?? "", e2025: fin?.ebitda?.["2025"]  ?? "",
    l2023: fin?.lucro?.["2023"]   ?? "", l2024: fin?.lucro?.["2024"]   ?? "", l2025: fin?.lucro?.["2025"]   ?? "",
  });

  // ── Step 4 — Jurídico ──
  const [s4, setS4] = useState({
    tem_processos:      jur?.tem_processos ? "sim" : "nao",
    detalhes_processos: jur?.detalhes_processos ?? "",
    tem_pendencias:     jur?.tem_pendencias ? "sim" : "nao",
    licencas:           jur?.licencas ?? "",
  });

  // ── Step 5 — Contato ──
  const [s5, setS5] = useState({
    contato_nome:     ct?.nome ?? "",
    contato_email:    ct?.email ?? "",
    contato_telefone: ct?.telefone ?? "",
    comissionamento:  String(ad.comissionamento ?? ""),
    info_adicionais:  String(ad.info_adicionais ?? ""),
  });

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    setError(null);

    const difArr = s2.diferenciais.split("\n").filter(Boolean);

    const newAssetData: AssetData = {
      ...ad,
      tipo_participante: s1.tipo_participante,
      tipoOperacao:      s1.tipoOperacao,
      cnpj:              s1.cnpj,
      founding_year:     s1.founding_year,
      descricao_ptbr:    s2.descricao_ptbr,
      produtos_servicos: s2.produtos_servicos,
      tese_investimento: s2.diferenciais,
      diferenciais:      difArr,
      mercado_atendido:  s2.mercado_atendido,
      financeiro: {
        receita: { "2023": s3.r2023, "2024": s3.r2024, "2025": s3.r2025 },
        ebitda:  { "2023": s3.e2023, "2024": s3.e2024, "2025": s3.e2025 },
        lucro:   { "2023": s3.l2023, "2024": s3.l2024, "2025": s3.l2025 },
      },
      divida_total: s3.divida_total,
      juridico: {
        licencas:           s4.licencas,
        tem_processos:      s4.tem_processos === "sim",
        detalhes_processos: s4.detalhes_processos,
        tem_pendencias:     s4.tem_pendencias === "sim",
      },
      contato: {
        nome:     s5.contato_nome,
        email:    s5.contato_email,
        telefone: s5.contato_telefone,
      },
      comissionamento: s5.comissionamento,
      info_adicionais: s5.info_adicionais,
      metricas: [
        ...(s3.r2025 ? [{ label: "Receita 2025", value: `R$ ${s3.r2025}`, sub: "Receita bruta" }] : []),
        ...(s3.e2025 ? [{ label: "EBITDA 2025",  value: `R$ ${s3.e2025}`,  sub: "Margem operacional" }] : []),
        ...(s3.divida_total ? [{ label: "Dívida Total", value: `R$ ${s3.divida_total}`, sub: "Posição atual" }] : []),
      ],
    };

    const payload = {
      id:             dealId,
      target_company: s1.target_company,
      sector:         s1.sector,
      location:       s1.location,
      deal_value:     s3.deal_value ? Number(s3.deal_value) : null,
      notes:          s5.info_adicionais || null,
      asset_data:     newAssetData,
    };

    try {
      const res = await fetch("/api/ma-deals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao salvar");
      setSuccess(true);
      setEditing(false);
      onSaved?.({ target_company: s1.target_company, sector: s1.sector, location: s1.location, deal_value: Number(s3.deal_value) || null, notes: s5.info_adicionais || null, asset_data: newAssetData });
      setTimeout(() => setSuccess(false), 3000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    }
    setSaving(false);
  }

  // ── Header row ──
  const borderColor = compact ? "border-[#122036]" : "border-[#243A66]";
  const bgHeader   = compact ? "bg-[#0F1E35]"   : "bg-[#162744]/50";
  const bgSection  = compact ? "bg-[#091221]"   : "bg-[#111F35]";

  return (
    <div className={`rounded-xl border ${borderColor} overflow-hidden`}>
      {/* Cabeçalho */}
      <div className={`flex items-center justify-between px-4 py-3 ${bgHeader}`}>
        <p className="text-[10px] font-bold tracking-widest uppercase text-[#C9A84C] flex items-center gap-1.5">
          <Pencil className="w-3 h-3" /> Editar Dados do Deal
        </p>
        <button
          onClick={() => { setEditing(e => !e); setError(null); }}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            editing
              ? "border-red-500/40 text-red-400 hover:bg-red-500/10"
              : `border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10`
          }`}
        >
          {editing ? <><X className="w-3 h-3 inline mr-1" />Cancelar</> : "Editar"}
        </button>
      </div>

      {success && (
        <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border-b border-emerald-500/20 text-xs text-emerald-400">
          <Check className="w-3.5 h-3.5" /> Deal atualizado com sucesso!
        </div>
      )}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-400">{error}</div>
      )}

      {editing && (
        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">

          {/* ── PASSO 1 — Identificação ── */}
          <div className={sectionCls}>
            <div className={sectionHeaderCls} onClick={() => toggle("s1")}>
              <span className={sectionTitleCls}>Identificação</span>
              {open.s1 ? <ChevronUp size={14} className="text-[#C9A84C]" /> : <ChevronDown size={14} className="text-[#7A8FA8]" />}
            </div>
            {open.s1 && (
              <div className={`p-4 space-y-3 ${bgSection}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Empresa / Ativo</label>
                    <input value={s1.target_company} onChange={e => setS1(p => ({ ...p, target_company: e.target.value }))} className={inputCls} placeholder="Nome da empresa ou ativo" />
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de Participante</label>
                    <select value={s1.tipo_participante} onChange={e => setS1(p => ({ ...p, tipo_participante: e.target.value }))} className={inputCls}>
                      <option value="Vendedor">Vendedor</option>
                      <option value="Investidor">Investidor</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Setor</label>
                    <select value={s1.sector} onChange={e => setS1(p => ({ ...p, sector: e.target.value }))} className={inputCls}>
                      <option value="">Selecione...</option>
                      {SETORES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Tipo de Operação</label>
                    <select value={s1.tipoOperacao} onChange={e => setS1(p => ({ ...p, tipoOperacao: e.target.value }))} className={inputCls}>
                      <option value="">Selecione...</option>
                      {TIPOS_DEAL.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Localização</label>
                    <input value={s1.location} onChange={e => setS1(p => ({ ...p, location: e.target.value }))} className={inputCls} placeholder="Ex: São Paulo · SP" />
                  </div>
                  <div>
                    <label className={labelCls}>CNPJ</label>
                    <input value={s1.cnpj} onChange={e => setS1(p => ({ ...p, cnpj: e.target.value }))} className={inputCls} placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <label className={labelCls}>Ano de Fundação</label>
                    <input value={s1.founding_year} onChange={e => setS1(p => ({ ...p, founding_year: e.target.value }))} className={inputCls} placeholder="Ex: 2010" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── PASSO 2 — Descrição ── */}
          <div className={sectionCls}>
            <div className={sectionHeaderCls} onClick={() => toggle("s2")}>
              <span className={sectionTitleCls}>Descrição</span>
              {open.s2 ? <ChevronUp size={14} className="text-[#C9A84C]" /> : <ChevronDown size={14} className="text-[#7A8FA8]" />}
            </div>
            {open.s2 && (
              <div className={`p-4 space-y-3 ${bgSection}`}>
                <div>
                  <label className={labelCls}>Descrição do Negócio</label>
                  <textarea value={s2.descricao_ptbr} onChange={e => setS2(p => ({ ...p, descricao_ptbr: e.target.value }))} rows={3} className={inputCls} placeholder="Descreva o negócio (mín. 30 caracteres)" />
                </div>
                <div>
                  <label className={labelCls}>Principais Produtos / Serviços</label>
                  <textarea value={s2.produtos_servicos} onChange={e => setS2(p => ({ ...p, produtos_servicos: e.target.value }))} rows={2} className={inputCls} placeholder="Descreva os produtos e serviços" />
                </div>
                <div>
                  <label className={labelCls}>Diferenciais Competitivos <span className="normal-case font-normal">(um por linha)</span></label>
                  <textarea value={s2.diferenciais} onChange={e => setS2(p => ({ ...p, diferenciais: e.target.value }))} rows={3} className={inputCls} placeholder="Um diferencial por linha..." />
                </div>
                <div>
                  <label className={labelCls}>Mercado Atendido</label>
                  <textarea value={s2.mercado_atendido} onChange={e => setS2(p => ({ ...p, mercado_atendido: e.target.value }))} rows={2} className={inputCls} placeholder="Perfil do cliente / mercado atendido" />
                </div>
              </div>
            )}
          </div>

          {/* ── PASSO 3 — Financeiro ── */}
          <div className={sectionCls}>
            <div className={sectionHeaderCls} onClick={() => toggle("s3")}>
              <span className={sectionTitleCls}>Financeiro</span>
              {open.s3 ? <ChevronUp size={14} className="text-[#C9A84C]" /> : <ChevronDown size={14} className="text-[#7A8FA8]" />}
            </div>
            {open.s3 && (
              <div className={`p-4 space-y-3 ${bgSection}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Valor Pretendido (R$)</label>
                    <input type="number" value={s3.deal_value} onChange={e => setS3(p => ({ ...p, deal_value: e.target.value }))} className={inputCls} placeholder="Ex: 5000000" />
                  </div>
                  <div>
                    <label className={labelCls}>Dívida Total (R$)</label>
                    <input value={s3.divida_total} onChange={e => setS3(p => ({ ...p, divida_total: e.target.value }))} className={inputCls} placeholder="Ex: 1200000" />
                  </div>
                </div>
                {/* Tabela de receita / ebitda / lucro */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left text-[10px] font-semibold text-[#7A8FA8] pb-2 w-20"></th>
                        {["2023", "2024", "2025"].map(a => <th key={a} className="text-center text-[10px] font-semibold text-[#7A8FA8] pb-2 px-1">{a}</th>)}
                      </tr>
                    </thead>
                    <tbody className="space-y-1">
                      {([
                        { label: "Receita", keys: ["r2023", "r2024", "r2025"] as const },
                        { label: "EBITDA",  keys: ["e2023", "e2024", "e2025"] as const },
                        { label: "Lucro",   keys: ["l2023", "l2024", "l2025"] as const },
                      ] as const).map(row => (
                        <tr key={row.label}>
                          <td className="pr-2 py-1 font-medium text-[#F0ECE4] text-[10px] uppercase tracking-wide">{row.label}</td>
                          {row.keys.map(k => (
                            <td key={k} className="px-1 py-1">
                              <input
                                value={s3[k]}
                                onChange={e => setS3(p => ({ ...p, [k]: e.target.value }))}
                                className="w-full rounded border border-[#243A66] bg-[#111F35] text-[#F0ECE4] text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50 placeholder:text-[#7A8FA8]"
                                placeholder="—"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* ── PASSO 4 — Jurídico ── */}
          <div className={sectionCls}>
            <div className={sectionHeaderCls} onClick={() => toggle("s4")}>
              <span className={sectionTitleCls}>Jurídico</span>
              {open.s4 ? <ChevronUp size={14} className="text-[#C9A84C]" /> : <ChevronDown size={14} className="text-[#7A8FA8]" />}
            </div>
            {open.s4 && (
              <div className={`p-4 space-y-3 ${bgSection}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Processos Judiciais</label>
                    <div className="flex gap-3 mt-1">
                      {(["sim", "nao"] as const).map(v => (
                        <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name={`processos_${dealId}`} value={v} checked={s4.tem_processos === v} onChange={() => setS4(p => ({ ...p, tem_processos: v }))} className="accent-[#C9A84C]" />
                          <span className="text-xs text-[#F0ECE4]">{v === "sim" ? "Sim" : "Não"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Pendências Fiscais</label>
                    <div className="flex gap-3 mt-1">
                      {(["sim", "nao"] as const).map(v => (
                        <label key={v} className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" name={`pendencias_${dealId}`} value={v} checked={s4.tem_pendencias === v} onChange={() => setS4(p => ({ ...p, tem_pendencias: v }))} className="accent-[#C9A84C]" />
                          <span className="text-xs text-[#F0ECE4]">{v === "sim" ? "Sim" : "Não"}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Licenças / Alvarás</label>
                    <input value={s4.licencas} onChange={e => setS4(p => ({ ...p, licencas: e.target.value }))} className={inputCls} placeholder="Ex: Licença de funcionamento, Alvará ambiental..." />
                  </div>
                  {s4.tem_processos === "sim" && (
                    <div className="col-span-2">
                      <label className={labelCls}>Detalhes dos Processos</label>
                      <textarea value={s4.detalhes_processos} onChange={e => setS4(p => ({ ...p, detalhes_processos: e.target.value }))} rows={2} className={inputCls} placeholder="Descreva os processos em andamento..." />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── PASSO 5 — Contato & Comissionamento ── */}
          <div className={sectionCls}>
            <div className={sectionHeaderCls} onClick={() => toggle("s5")}>
              <span className={sectionTitleCls}>Contato</span>
              {open.s5 ? <ChevronUp size={14} className="text-[#C9A84C]" /> : <ChevronDown size={14} className="text-[#7A8FA8]" />}
            </div>
            {open.s5 && (
              <div className={`p-4 space-y-3 ${bgSection}`}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className={labelCls}>Nome do Responsável</label>
                    <input value={s5.contato_nome} onChange={e => setS5(p => ({ ...p, contato_nome: e.target.value }))} className={inputCls} placeholder="Nome completo" />
                  </div>
                  <div>
                    <label className={labelCls}>E-mail</label>
                    <input type="email" value={s5.contato_email} onChange={e => setS5(p => ({ ...p, contato_email: e.target.value }))} className={inputCls} placeholder="email@empresa.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Telefone / WhatsApp</label>
                    <input value={s5.contato_telefone} onChange={e => setS5(p => ({ ...p, contato_telefone: e.target.value }))} className={inputCls} placeholder="(11) 99999-9999" />
                  </div>
                  <div>
                    <label className={labelCls}>Comissionamento (%)</label>
                    <input value={s5.comissionamento} onChange={e => setS5(p => ({ ...p, comissionamento: e.target.value }))} className={inputCls} placeholder="Ex: 3" />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Informações Adicionais</label>
                    <textarea value={s5.info_adicionais} onChange={e => setS5(p => ({ ...p, info_adicionais: e.target.value }))} rows={2} className={inputCls} placeholder="Observações relevantes sobre a operação..." />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Botão salvar ── */}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold py-2.5 hover:bg-[#E8C97A] transition-colors disabled:opacity-50"
          >
            {saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...</>
              : <><Check className="w-3.5 h-3.5" /> Salvar Todas as Alterações</>}
          </button>

        </div>
      )}
    </div>
  );
}
