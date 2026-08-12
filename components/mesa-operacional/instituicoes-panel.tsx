"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, Plus, ChevronDown, ChevronUp, Search, Loader2, Trash2, Edit2,
  Phone, Mail, Link2, Eye, EyeOff, User, X, Briefcase, Landmark,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Tipos ─────────────────────────────────────────────────────────────────
interface LinhaInstituicao {
  id: string;
  instituicao_id: string;
  nome: string;
  categoria: string | null;
  cor: string | null;
  emoji: string | null;
  tipo_pessoa: "PF" | "PJ" | "AMBOS";
  requer_imovel: boolean;
  bloqueia_restricao: boolean;
  valor_minimo: number | null;
  valor_maximo: number | null;
  ltv_maximo: number | null;
  min_renda_mensal: number | null;
  min_faturamento_mensal: number | null;
  score_base: number | null;
  keywords_finalidade: string[] | null;
  descricao: string | null;
  observacoes_internas: string | null;
  ativo: boolean;
  ordem: number;
}

interface Instituicao {
  id: string;
  nome: string;
  cnpj: string | null;
  email: string;
  status: "ativo" | "inativo";
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  portal_url: string | null;
  portal_usuario: string | null;
  portal_senha: string | null;
  observacoes: string | null;
  linhas: LinhaInstituicao[];
}

const TIPO_PESSOA_LABEL: Record<string, string> = { PF: "Pessoa Física", PJ: "Pessoa Jurídica", AMBOS: "PF e PJ" };

function fmtMoney(v: number | null | undefined) {
  if (v === null || v === undefined) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

const inputCls = "w-full h-9 px-3 text-xs rounded-xl border border-[#243A66] bg-[#111F35] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/50";
const textareaCls = inputCls + " h-auto py-2 resize-none";
const labelCls = "text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1 block";

// ─── Form: Linha ────────────────────────────────────────────────────────────
interface LinhaFormState {
  nome: string; categoria: string; cor: string; emoji: string;
  tipo_pessoa: "PF" | "PJ" | "AMBOS";
  requer_imovel: boolean; bloqueia_restricao: boolean;
  valor_minimo: string; valor_maximo: string; ltv_maximo: string;
  min_renda_mensal: string; min_faturamento_mensal: string; score_base: string;
  keywords_finalidade: string; descricao: string; observacoes_internas: string;
}

const EMPTY_LINHA_FORM: LinhaFormState = {
  nome: "", categoria: "", cor: "#C9A84C", emoji: "",
  tipo_pessoa: "AMBOS", requer_imovel: false, bloqueia_restricao: true,
  valor_minimo: "", valor_maximo: "", ltv_maximo: "",
  min_renda_mensal: "", min_faturamento_mensal: "", score_base: "",
  keywords_finalidade: "", descricao: "", observacoes_internas: "",
};

function linhaToForm(l: LinhaInstituicao): LinhaFormState {
  return {
    nome: l.nome, categoria: l.categoria ?? "", cor: l.cor ?? "#C9A84C", emoji: l.emoji ?? "",
    tipo_pessoa: l.tipo_pessoa, requer_imovel: l.requer_imovel, bloqueia_restricao: l.bloqueia_restricao,
    valor_minimo: l.valor_minimo?.toString() ?? "", valor_maximo: l.valor_maximo?.toString() ?? "",
    ltv_maximo: l.ltv_maximo?.toString() ?? "",
    min_renda_mensal: l.min_renda_mensal?.toString() ?? "", min_faturamento_mensal: l.min_faturamento_mensal?.toString() ?? "",
    score_base: l.score_base?.toString() ?? "",
    keywords_finalidade: (l.keywords_finalidade ?? []).join(", "),
    descricao: l.descricao ?? "", observacoes_internas: l.observacoes_internas ?? "",
  };
}

function linhaFormToPayload(f: LinhaFormState) {
  const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
  return {
    nome: f.nome.trim(),
    categoria: f.categoria.trim() || null,
    cor: f.cor.trim() || null,
    emoji: f.emoji.trim() || null,
    tipo_pessoa: f.tipo_pessoa,
    requer_imovel: f.requer_imovel,
    bloqueia_restricao: f.bloqueia_restricao,
    valor_minimo: num(f.valor_minimo),
    valor_maximo: num(f.valor_maximo),
    ltv_maximo: num(f.ltv_maximo),
    min_renda_mensal: num(f.min_renda_mensal),
    min_faturamento_mensal: num(f.min_faturamento_mensal),
    score_base: f.score_base.trim() === "" ? null : parseInt(f.score_base, 10),
    keywords_finalidade: f.keywords_finalidade.trim()
      ? f.keywords_finalidade.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean)
      : null,
    descricao: f.descricao.trim() || null,
    observacoes_internas: f.observacoes_internas.trim() || null,
  };
}

function LinhaFormModal({
  initial, onClose, onSave, saving,
}: {
  initial: LinhaFormState;
  onClose: () => void;
  onSave: (payload: ReturnType<typeof linhaFormToPayload>) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<LinhaFormState>(initial);
  const set = <K extends keyof LinhaFormState>(k: K, v: LinhaFormState[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-xl max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-bold text-foreground">{initial.nome ? "Editar Linha" : "Nova Linha"}</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div>
            <label className={labelCls}>Nome da linha *</label>
            <input className={inputCls} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Crédito com Garantia Imobiliária" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Categoria</label>
              <input className={inputCls} value={f.categoria} onChange={(e) => set("categoria", e.target.value)} placeholder="Ex.: Imobiliário" />
            </div>
            <div>
              <label className={labelCls}>Público-alvo</label>
              <select className={inputCls} value={f.tipo_pessoa} onChange={(e) => set("tipo_pessoa", e.target.value as LinhaFormState["tipo_pessoa"])}>
                <option value="AMBOS">PF e PJ</option>
                <option value="PF">Pessoa Física</option>
                <option value="PJ">Pessoa Jurídica</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Valor mínimo (R$)</label>
              <input className={inputCls} inputMode="decimal" value={f.valor_minimo} onChange={(e) => set("valor_minimo", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Valor máximo (R$)</label>
              <input className={inputCls} inputMode="decimal" value={f.valor_maximo} onChange={(e) => set("valor_maximo", e.target.value)} placeholder="Sem limite" />
            </div>
            <div>
              <label className={labelCls}>LTV máximo</label>
              <input className={inputCls} inputMode="decimal" value={f.ltv_maximo} onChange={(e) => set("ltv_maximo", e.target.value)} placeholder="Ex.: 0.60" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Renda mínima (R$)</label>
              <input className={inputCls} inputMode="decimal" value={f.min_renda_mensal} onChange={(e) => set("min_renda_mensal", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Faturamento mín. (R$)</label>
              <input className={inputCls} inputMode="decimal" value={f.min_faturamento_mensal} onChange={(e) => set("min_faturamento_mensal", e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className={labelCls}>Score base</label>
              <input className={inputCls} inputMode="numeric" value={f.score_base} onChange={(e) => set("score_base", e.target.value)} placeholder="0–100" />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={f.requer_imovel} onChange={(e) => set("requer_imovel", e.target.checked)} className="accent-[#C9A84C] w-3.5 h-3.5" />
              Exige imóvel em garantia
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer">
              <input type="checkbox" checked={f.bloqueia_restricao} onChange={(e) => set("bloqueia_restricao", e.target.checked)} className="accent-[#C9A84C] w-3.5 h-3.5" />
              Bloqueia com restrição/negativado
            </label>
          </div>
          <div>
            <label className={labelCls}>Palavras-chave de finalidade (separadas por vírgula)</label>
            <input className={inputCls} value={f.keywords_finalidade} onChange={(e) => set("keywords_finalidade", e.target.value)} placeholder="imovel, capital de giro, refinanciamento" />
          </div>
          <div>
            <label className={labelCls}>Descrição (taxa, prazo, condições)</label>
            <textarea className={textareaCls} rows={3} value={f.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Taxa, prazo, amortização, diferenciais…" />
          </div>
          <div>
            <label className={labelCls}>Observações internas (Mesa Operacional)</label>
            <textarea className={textareaCls} rows={2} value={f.observacoes_internas} onChange={(e) => set("observacoes_internas", e.target.value)} placeholder="Notas de uso interno, não visível ao parceiro" />
          </div>
        </div>
        <div className="p-4 border-t border-[#C9A84C]/20 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
          <button
            disabled={saving || !f.nome.trim()}
            onClick={() => onSave(linhaFormToPayload(f))}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Form: Instituição ──────────────────────────────────────────────────────
interface InstFormState {
  nome: string; cnpj: string; email: string; status: "ativo" | "inativo";
  contato_nome: string; contato_telefone: string; contato_email: string;
  portal_url: string; portal_usuario: string; portal_senha: string;
  observacoes: string;
}

const EMPTY_INST_FORM: InstFormState = {
  nome: "", cnpj: "", email: "", status: "ativo",
  contato_nome: "", contato_telefone: "", contato_email: "",
  portal_url: "", portal_usuario: "", portal_senha: "",
  observacoes: "",
};

function instToForm(i: Instituicao): InstFormState {
  return {
    nome: i.nome, cnpj: i.cnpj ?? "", email: i.email ?? "", status: i.status,
    contato_nome: i.contato_nome ?? "", contato_telefone: i.contato_telefone ?? "", contato_email: i.contato_email ?? "",
    portal_url: i.portal_url ?? "", portal_usuario: i.portal_usuario ?? "", portal_senha: i.portal_senha ?? "",
    observacoes: i.observacoes ?? "",
  };
}

function InstFormModal({
  initial, onClose, onSave, saving,
}: {
  initial: InstFormState;
  onClose: () => void;
  onSave: (payload: InstFormState) => void;
  saving: boolean;
}) {
  const [f, setF] = useState<InstFormState>(initial);
  const [showSenha, setShowSenha] = useState(false);
  const set = <K extends keyof InstFormState>(k: K, v: InstFormState[K]) => setF((p) => ({ ...p, [k]: v }));

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[85vh] bg-[#09081A] border border-[#C9A84C]/20 rounded-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#C9A84C]/20 flex items-center justify-between flex-shrink-0">
          <div className="text-sm font-bold text-foreground">{initial.nome ? "Editar Instituição" : "Nova Instituição"}</div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Nome da instituição *</label>
              <input className={inputCls} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Ex.: Banco XYZ" />
            </div>
            <div>
              <label className={labelCls}>CNPJ</label>
              <input className={inputCls} value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0001-00" />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value as "ativo" | "inativo")}>
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>
          </div>

          <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest pt-2 border-t border-[#1B3050]">Contato Responsável</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nome do contato</label>
              <input className={inputCls} value={f.contato_nome} onChange={(e) => set("contato_nome", e.target.value)} placeholder="Ex.: Maria Souza" />
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <input className={inputCls} value={f.contato_telefone} onChange={(e) => set("contato_telefone", e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>E-mail do contato</label>
              <input className={inputCls} value={f.contato_email} onChange={(e) => set("contato_email", e.target.value)} placeholder="contato@instituicao.com.br" />
            </div>
          </div>

          <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest pt-2 border-t border-[#1B3050]">Acesso ao Portal (opcional)</p>
          <div className="space-y-3">
            <div>
              <label className={labelCls}>Link da plataforma</label>
              <input className={inputCls} value={f.portal_url} onChange={(e) => set("portal_url", e.target.value)} placeholder="https://portal.instituicao.com.br" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Usuário / login</label>
                <input className={inputCls} value={f.portal_usuario} onChange={(e) => set("portal_usuario", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Senha</label>
                <div className="relative">
                  <input
                    className={inputCls + " pr-8"}
                    type={showSenha ? "text" : "password"}
                    value={f.portal_senha}
                    onChange={(e) => set("portal_senha", e.target.value)}
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowSenha((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showSenha ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 italic">Visível apenas para Mesa Operacional, Gestão e Admin.</p>
          </div>

          <div>
            <label className={labelCls}>Observações</label>
            <textarea className={textareaCls} rows={2} value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} />
          </div>
        </div>
        <div className="p-4 border-t border-[#C9A84C]/20 flex justify-end gap-2 flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground">Cancelar</button>
          <button
            disabled={saving || !f.nome.trim()}
            onClick={() => onSave(f)}
            className="px-4 py-2 rounded-lg text-xs font-bold bg-[#C9A84C] text-[#09081A] hover:bg-[#E8C97A] transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de Linha ──────────────────────────────────────────────────────────
function LinhaRow({ linha, onEdit, onDelete }: { linha: LinhaInstituicao; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const chips: { label: string; value: string }[] = [];
  const min = fmtMoney(linha.valor_minimo);
  const max = fmtMoney(linha.valor_maximo);
  if (min || max) chips.push({ label: "Faixa", value: `${min ?? "—"} a ${max ?? "sem limite"}` });
  if (linha.ltv_maximo) chips.push({ label: "LTV máx.", value: `${(linha.ltv_maximo * 100).toFixed(0)}%` });
  if (linha.score_base !== null) chips.push({ label: "Score base", value: String(linha.score_base) });

  return (
    <div className={cn(
      "rounded-xl border transition-all overflow-hidden",
      open ? "border-[#C9A84C]/30 bg-[#0C1929]" : "border-[#1B3050] bg-[#0A1628] hover:border-[#243A66]"
    )}>
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-start gap-3 p-3.5 text-left">
        <div className="w-7 h-7 rounded-lg bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs">
          {linha.emoji || <Briefcase className="w-3.5 h-3.5 text-[#C9A84C]" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <p className="text-xs font-bold text-white">{linha.nome}</p>
            <span className="text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/25">
              {TIPO_PESSOA_LABEL[linha.tipo_pessoa]}
            </span>
            {linha.categoria && (
              <span className="text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide bg-[#162744] text-muted-foreground border-[#243A66]">
                {linha.categoria}
              </span>
            )}
            {!linha.ativo && (
              <span className="text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide bg-red-500/10 text-red-400 border-red-500/25">
                Inativa
              </span>
            )}
          </div>
          {!open && chips.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1.5">
              {chips.map((c) => (
                <span key={c.label} className="text-[10px] bg-[#162744] border border-[#243A66] rounded-lg px-2 py-0.5 text-muted-foreground">
                  <strong className="text-[#C9A84C]">{c.label}:</strong> {c.value}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-shrink-0 text-muted-foreground mt-1">
          {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </div>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 border-t border-[#1B3050] pt-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mb-3">
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Valor mínimo</p><p className="text-xs text-foreground">{min ?? "—"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Valor máximo</p><p className="text-xs text-foreground">{max ?? "Sem limite"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">LTV máximo</p><p className="text-xs text-foreground">{linha.ltv_maximo ? `${(linha.ltv_maximo * 100).toFixed(0)}%` : "—"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Renda mínima</p><p className="text-xs text-foreground">{fmtMoney(linha.min_renda_mensal) ?? "—"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Faturamento mín.</p><p className="text-xs text-foreground">{fmtMoney(linha.min_faturamento_mensal) ?? "—"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Score base</p><p className="text-xs text-foreground">{linha.score_base ?? "—"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Exige imóvel</p><p className="text-xs text-foreground">{linha.requer_imovel ? "Sim" : "Não"}</p></div>
            <div><p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Bloqueia restrição</p><p className="text-xs text-foreground">{linha.bloqueia_restricao ? "Sim" : "Não"}</p></div>
          </div>
          {linha.keywords_finalidade && linha.keywords_finalidade.length > 0 && (
            <div className="mb-3">
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1">Palavras-chave</p>
              <div className="flex flex-wrap gap-1.5">
                {linha.keywords_finalidade.map((k) => (
                  <span key={k} className="text-[10px] bg-[#162744] border border-[#243A66] rounded-full px-2 py-0.5 text-muted-foreground">{k}</span>
                ))}
              </div>
            </div>
          )}
          {linha.descricao && (
            <div className="mb-3">
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-1">Descrição</p>
              <p className="text-xs text-foreground leading-relaxed">{linha.descricao}</p>
            </div>
          )}
          {linha.observacoes_internas && (
            <div className="mb-3">
              <p className="text-[9px] font-bold text-amber-400 uppercase tracking-widest mb-1">Observações internas</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{linha.observacoes_internas}</p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onEdit} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#243A66] text-[10px] text-muted-foreground hover:text-[#C9A84C] hover:border-[#C9A84C]/40 transition-colors">
              <Edit2 className="w-3 h-3" /> Editar
            </button>
            <button onClick={onDelete} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/20 text-[10px] text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3 h-3" /> Excluir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Card de Instituição ────────────────────────────────────────────────────
function InstituicaoCard({
  inst, canManage, onEditInst, onDeleteInst, onAddLinha, onEditLinha, onDeleteLinha,
}: {
  inst: Instituicao;
  canManage: boolean;
  onEditInst: () => void;
  onDeleteInst: () => void;
  onAddLinha: () => void;
  onEditLinha: (l: LinhaInstituicao) => void;
  onDeleteLinha: (l: LinhaInstituicao) => void;
}) {
  const [open, setOpen] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const linhasAtivas = inst.linhas?.filter((l) => l.ativo).length ?? 0;

  return (
    <div className={cn(
      "rounded-2xl border transition-all duration-200 overflow-hidden",
      open ? "border-[#C9A84C]/30 bg-[#0C1929]" : "border-[#1B3050] bg-[#0A1628] hover:border-[#243A66]"
    )}>
      <div className="w-full flex items-start gap-4 p-5">
        <button onClick={() => setOpen((v) => !v)} className="flex items-start gap-4 flex-1 text-left min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#C9A84C]/15 border border-[#C9A84C]/25 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Landmark className="w-4 h-4 text-[#C9A84C]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <p className="text-sm font-bold text-white">{inst.nome}</p>
              <span className={cn(
                "text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide",
                inst.status === "ativo" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" : "bg-red-500/10 text-red-400 border-red-500/25"
              )}>
                {inst.status === "ativo" ? "Ativa" : "Inativa"}
              </span>
              <span className="text-[9px] font-bold border px-2 py-0.5 rounded-full uppercase tracking-wide bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/25">
                {linhasAtivas} linha{linhasAtivas !== 1 ? "s" : ""}
              </span>
            </div>
            {inst.cnpj && <p className="text-[10px] text-muted-foreground">{inst.cnpj}</p>}
            {!open && inst.contato_nome && (
              <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                <User className="w-2.5 h-2.5" /> {inst.contato_nome}
              </p>
            )}
          </div>
        </button>
        <div className="flex-shrink-0 flex items-center gap-1">
          {canManage && (
            <button onClick={onEditInst} title="Editar instituição" className="w-8 h-8 rounded-lg border border-[#243A66] text-muted-foreground hover:text-[#C9A84C] hover:border-[#C9A84C]/40 flex items-center justify-center transition-colors">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canManage && (
            <button onClick={onDeleteInst} title="Excluir instituição" className="w-8 h-8 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 flex items-center justify-center transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => setOpen((v) => !v)} className="w-8 h-8 rounded-lg text-muted-foreground flex items-center justify-center">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="px-5 pb-5 border-t border-[#1B3050] pt-4 space-y-4">
          {/* Contato + Portal */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-3.5">
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-2">Contato Responsável</p>
              {inst.contato_nome || inst.contato_telefone || inst.contato_email ? (
                <div className="space-y-1.5">
                  {inst.contato_nome && <p className="text-xs text-foreground flex items-center gap-1.5"><User className="w-3 h-3 text-muted-foreground" /> {inst.contato_nome}</p>}
                  {inst.contato_telefone && <p className="text-xs text-foreground flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" /> {inst.contato_telefone}</p>}
                  {inst.contato_email && <p className="text-xs text-foreground flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground" /> {inst.contato_email}</p>}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Nenhum contato cadastrado</p>
              )}
            </div>
            <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-3.5">
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest mb-2">Acesso ao Portal</p>
              {inst.portal_url || inst.portal_usuario ? (
                <div className="space-y-1.5">
                  {inst.portal_url && (
                    <a href={inst.portal_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#7DD3FC] hover:underline flex items-center gap-1.5 break-all">
                      <Link2 className="w-3 h-3 flex-shrink-0" /> {inst.portal_url}
                    </a>
                  )}
                  {inst.portal_usuario && <p className="text-xs text-foreground">Usuário: <span className="font-mono">{inst.portal_usuario}</span></p>}
                  {inst.portal_senha && (
                    <p className="text-xs text-foreground flex items-center gap-1.5">
                      Senha: <span className="font-mono">{showSenha ? inst.portal_senha : "••••••••"}</span>
                      <button onClick={() => setShowSenha((v) => !v)} className="text-muted-foreground hover:text-[#C9A84C]">
                        {showSenha ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">Sem acesso a portal cadastrado</p>
              )}
            </div>
          </div>

          {inst.observacoes && (
            <p className="text-xs text-muted-foreground leading-relaxed italic">{inst.observacoes}</p>
          )}

          {/* Linhas */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Linhas de Crédito / Produto</p>
              {canManage && (
                <button onClick={onAddLinha} className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/10 text-[#C9A84C] text-[10px] font-bold hover:bg-[#C9A84C]/20 transition-colors">
                  <Plus className="w-3 h-3" /> Nova Linha
                </button>
              )}
            </div>
            {(!inst.linhas || inst.linhas.length === 0) ? (
              <p className="text-xs text-muted-foreground italic py-3">Nenhuma linha cadastrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {inst.linhas.map((l) => (
                  <LinhaRow key={l.id} linha={l} onEdit={() => onEditLinha(l)} onDelete={() => onDeleteLinha(l)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Painel principal ───────────────────────────────────────────────────────
export function InstituicoesPanel({ currentUser }: { currentUser?: { id: string; full_name: string; role: string } }) {
  const [instituicoes, setInstituicoes] = useState<Instituicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const [showNovaInst, setShowNovaInst] = useState(false);
  const [editInst, setEditInst] = useState<Instituicao | null>(null);
  const [linhaTarget, setLinhaTarget] = useState<{ instituicaoId: string; linha: LinhaInstituicao | null } | null>(null);

  const canManage = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(currentUser?.role ?? "");

  const fetchInstituicoes = useCallback(() => {
    setLoading(true);
    fetch("/api/instituicoes")
      .then((r) => r.json())
      .then((data) => setInstituicoes(data.instituicoes ?? []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchInstituicoes(); }, [fetchInstituicoes]);

  async function saveInstituicao(payload: InstFormState) {
    setSaving(true);
    try {
      if (editInst) {
        await fetch(`/api/instituicoes/${editInst.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/instituicoes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      }
      setShowNovaInst(false);
      setEditInst(null);
      fetchInstituicoes();
    } finally {
      setSaving(false);
    }
  }

  async function deleteInstituicao(inst: Instituicao) {
    if (!confirm(`Excluir a instituição "${inst.nome}" e todas as suas linhas cadastradas?`)) return;
    await fetch(`/api/instituicoes/${inst.id}`, { method: "DELETE" });
    fetchInstituicoes();
  }

  async function saveLinha(payload: ReturnType<typeof linhaFormToPayload>) {
    if (!linhaTarget) return;
    setSaving(true);
    try {
      if (linhaTarget.linha) {
        await fetch(`/api/instituicoes/linhas/${linhaTarget.linha.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      } else {
        await fetch("/api/instituicoes/linhas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, instituicao_id: linhaTarget.instituicaoId }) });
      }
      setLinhaTarget(null);
      fetchInstituicoes();
    } finally {
      setSaving(false);
    }
  }

  async function deleteLinha(l: LinhaInstituicao) {
    if (!confirm(`Excluir a linha "${l.nome}"?`)) return;
    await fetch(`/api/instituicoes/linhas/${l.id}`, { method: "DELETE" });
    fetchInstituicoes();
  }

  const filtered = instituicoes.filter((i) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return i.nome.toLowerCase().includes(s)
      || (i.cnpj ?? "").toLowerCase().includes(s)
      || (i.linhas ?? []).some((l) => l.nome.toLowerCase().includes(s) || (l.categoria ?? "").toLowerCase().includes(s));
  });

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Instituições Parceiras</h2>
            <p className="text-xs text-muted-foreground">Cadastro de instituições, linhas de crédito e parâmetros para encaixe de perfil do cliente</p>
          </div>
        </div>
        {canManage && (
          <button
            onClick={() => setShowNovaInst(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold hover:bg-[#E8C97A] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Nova Instituição
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Buscar instituição ou linha…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 text-xs rounded-xl border border-[#243A66] bg-[#111F35] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#C9A84C]/50"
        />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Carregando instituições…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground gap-2">
          <Landmark className="w-8 h-8 opacity-20" />
          <p className="text-sm">{search ? "Nenhuma instituição encontrada" : "Nenhuma instituição cadastrada ainda"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((inst) => (
            <InstituicaoCard
              key={inst.id}
              inst={inst}
              canManage={canManage}
              onEditInst={() => setEditInst(inst)}
              onDeleteInst={() => deleteInstituicao(inst)}
              onAddLinha={() => setLinhaTarget({ instituicaoId: inst.id, linha: null })}
              onEditLinha={(l) => setLinhaTarget({ instituicaoId: inst.id, linha: l })}
              onDeleteLinha={(l) => deleteLinha(l)}
            />
          ))}
        </div>
      )}

      {/* Modais */}
      {showNovaInst && (
        <InstFormModal initial={EMPTY_INST_FORM} onClose={() => setShowNovaInst(false)} onSave={saveInstituicao} saving={saving} />
      )}
      {editInst && (
        <InstFormModal initial={instToForm(editInst)} onClose={() => setEditInst(null)} onSave={saveInstituicao} saving={saving} />
      )}
      {linhaTarget && (
        <LinhaFormModal
          initial={linhaTarget.linha ? linhaToForm(linhaTarget.linha) : EMPTY_LINHA_FORM}
          onClose={() => setLinhaTarget(null)}
          onSave={saveLinha}
          saving={saving}
        />
      )}
    </div>
  );
}
