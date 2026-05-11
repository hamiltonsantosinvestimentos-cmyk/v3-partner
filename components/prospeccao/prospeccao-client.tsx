"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Plus, X, ChevronRight, ChevronLeft, Link2, MessageCircle, Mail,
  Copy, Check, User, MapPin, Phone, Building2, Search,
  Loader2, Trash2, Pencil, RefreshCw, AlertCircle, ExternalLink,
  Crown, Users, Target, TrendingUp,
} from "lucide-react";

const GOLD = "#C9A84C";
const NAVY_CARD = "#162744";
const NAVY_BASE = "#111F35";
const MUTED = "#7A8FA8";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Prospect {
  id: string;
  nome: string;
  documento?: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  estado?: string;
  origem: string;
  indicado_por_partner_id?: string;
  indicado_por_nome?: string;
  responsavel_id?: string;
  responsavel_nome?: string;
  etapa: Etapa;
  motivo_perda?: string;
  notas?: string;
  link_token?: string;
  link_gerado_em?: string;
  convertido_em?: string;
  comissao_gerada: boolean;
  created_at: string;
  indicado_por_partner?: { id: string; full_name: string } | null;
  responsavel?: { id: string; full_name: string } | null;
}

interface Equipe { id: string; full_name: string; role: string; }
interface Partner { id: string; full_name: string; email: string; }

type Etapa = "prospect" | "contatado" | "interessado" | "trial" | "convertido" | "perdido";

const ETAPAS: { id: Etapa; label: string; color: string; bg: string }[] = [
  { id: "prospect",    label: "Prospect",    color: "#7A8FA8", bg: "#7A8FA820" },
  { id: "contatado",   label: "Contatado",   color: "#60A5FA", bg: "#60A5FA20" },
  { id: "interessado", label: "Interessado", color: "#F59E0B", bg: "#F59E0B20" },
  { id: "trial",       label: "Em Trial",    color: "#A78BFA", bg: "#A78BFA20" },
  { id: "convertido",  label: "Convertido",  color: "#34D399", bg: "#34D39920" },
];

const ORIGENS = [
  { value: "linkedin",   label: "LinkedIn" },
  { value: "instagram",  label: "Instagram" },
  { value: "indicacao",  label: "Indicação" },
  { value: "youtube",    label: "YouTube" },
  { value: "google",     label: "Google" },
  { value: "evento",     label: "Evento" },
  { value: "outro",      label: "Outro" },
];

const ESTADOS_BR = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS",
  "MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function origemLabel(o: string) {
  return ORIGENS.find(x => x.value === o)?.label ?? o;
}

function origemColor(o: string) {
  const map: Record<string, string> = {
    linkedin: "#0A66C2", instagram: "#E1306C", indicacao: GOLD,
    youtube: "#FF0000", google: "#4285F4", evento: "#A78BFA", outro: MUTED,
  };
  return map[o] ?? MUTED;
}

// ─── Modal de criação/edição ───────────────────────────────────────────────────

function ProspectModal({
  initial, equipe, partners, onSave, onClose,
}: {
  initial?: Prospect | null;
  equipe: Equipe[];
  partners: Partner[];
  onSave: (data: Record<string, string>) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    nome: initial?.nome ?? "",
    documento: initial?.documento ?? "",
    email: initial?.email ?? "",
    telefone: initial?.telefone ?? "",
    cidade: initial?.cidade ?? "",
    estado: initial?.estado ?? "",
    origem: initial?.origem ?? "linkedin",
    indicado_por_partner_id: initial?.indicado_por_partner_id ?? "",
    indicado_por_nome: initial?.indicado_por_nome ?? "",
    responsavel_id: initial?.responsavel_id ?? "",
    notas: initial?.notas ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.nome.trim()) { setErr("Nome é obrigatório"); return; }
    setSaving(true); setErr(null);
    try { await onSave(form); }
    catch (e) { setErr((e as Error).message); }
    finally { setSaving(false); }
  };

  const labelCls = "text-[11px] font-semibold uppercase tracking-widest mb-1 block";
  const inputCls = "w-full rounded-xl px-3 py-2 text-sm text-white border border-white/10 focus:border-yellow-500/50 focus:outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000080" }}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden" style={{ background: "#0F1E35" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-base font-bold text-white">
            {initial ? "Editar Prospect" : "Novo Prospect"}
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Nome */}
          <div>
            <label className={labelCls} style={{ color: GOLD }}>Nome / Razão Social *</label>
            <input
              value={form.nome}
              onChange={e => set("nome", e.target.value)}
              placeholder="Nome completo ou razão social"
              className={inputCls}
              style={{ background: NAVY_CARD }}
            />
          </div>

          {/* Documento + Telefone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: MUTED }}>CPF / CNPJ</label>
              <input
                value={form.documento}
                onChange={e => set("documento", e.target.value)}
                placeholder="000.000.000-00"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>Telefone</label>
              <input
                value={form.telefone}
                onChange={e => set("telefone", e.target.value)}
                placeholder="(11) 99999-9999"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className={labelCls} style={{ color: MUTED }}>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set("email", e.target.value)}
              placeholder="email@exemplo.com"
              className={inputCls}
              style={{ background: NAVY_CARD }}
            />
          </div>

          {/* Cidade + Estado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={{ color: MUTED }}>Cidade</label>
              <input
                value={form.cidade}
                onChange={e => set("cidade", e.target.value)}
                placeholder="São Paulo"
                className={inputCls}
                style={{ background: NAVY_CARD }}
              />
            </div>
            <div>
              <label className={labelCls} style={{ color: MUTED }}>Estado</label>
              <select
                value={form.estado}
                onChange={e => set("estado", e.target.value)}
                className={inputCls}
                style={{ background: NAVY_CARD }}
              >
                <option value="">Selecione</option>
                {ESTADOS_BR.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Origem */}
          <div>
            <label className={labelCls} style={{ color: MUTED }}>Onde conheceu a V3 *</label>
            <select
              value={form.origem}
              onChange={e => set("origem", e.target.value)}
              className={inputCls}
              style={{ background: NAVY_CARD }}
            >
              {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          {/* Indicação */}
          {form.origem === "indicacao" && (
            <div className="rounded-xl border border-yellow-500/20 p-3 space-y-3" style={{ background: `${GOLD}08` }}>
              <p className="text-xs font-semibold" style={{ color: GOLD }}>Detalhes da Indicação</p>
              <div>
                <label className={labelCls} style={{ color: MUTED }}>Partner que indicou (se for partner)</label>
                <select
                  value={form.indicado_por_partner_id}
                  onChange={e => set("indicado_por_partner_id", e.target.value)}
                  className={inputCls}
                  style={{ background: NAVY_CARD }}
                >
                  <option value="">Não é um partner cadastrado</option>
                  {partners.map(p => <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>)}
                </select>
              </div>
              {!form.indicado_por_partner_id && (
                <div>
                  <label className={labelCls} style={{ color: MUTED }}>Nome de quem indicou</label>
                  <input
                    value={form.indicado_por_nome}
                    onChange={e => set("indicado_por_nome", e.target.value)}
                    placeholder="Nome do indicante"
                    className={inputCls}
                    style={{ background: NAVY_CARD }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Responsável */}
          <div>
            <label className={labelCls} style={{ color: MUTED }}>Responsável (SDR / Closer)</label>
            <select
              value={form.responsavel_id}
              onChange={e => set("responsavel_id", e.target.value)}
              className={inputCls}
              style={{ background: NAVY_CARD }}
            >
              <option value="">Sem responsável</option>
              {equipe.map(e => <option key={e.id} value={e.id}>{e.full_name} ({e.role})</option>)}
            </select>
          </div>

          {/* Notas */}
          <div>
            <label className={labelCls} style={{ color: MUTED }}>Notas</label>
            <textarea
              value={form.notas}
              onChange={e => set("notas", e.target.value)}
              rows={3}
              placeholder="Observações, contexto, próximos passos…"
              className={`${inputCls} resize-none`}
              style={{ background: NAVY_CARD }}
            />
          </div>

          {err && (
            <p className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> {err}
            </p>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl text-sm border border-white/10 text-muted-foreground hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-2 rounded-xl text-sm font-semibold text-black flex items-center justify-center gap-2"
            style={{ background: GOLD }}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {initial ? "Salvar alterações" : "Criar Prospect"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Detalhe do Prospect ────────────────────────────────────────────

function DetalheModal({
  prospect, onClose, onEdit, onLink, isAdmin, onDelete,
}: {
  prospect: Prospect;
  onClose: () => void;
  onEdit: (p: Prospect) => void;
  onLink: (p: Prospect) => void;
  onDelete: (id: string) => void;
  isAdmin: boolean;
}) {
  const etapa = ETAPAS.find(e => e.id === prospect.etapa);
  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

  const rows: Array<{ label: string; value: string | null | undefined }> = [
    { label: "Nome / Razão Social", value: prospect.nome },
    { label: "CPF / CNPJ", value: prospect.documento },
    { label: "E-mail", value: prospect.email },
    { label: "Telefone", value: prospect.telefone },
    { label: "Cidade", value: prospect.cidade },
    { label: "Estado", value: prospect.estado },
    { label: "Origem", value: origemLabel(prospect.origem) },
    { label: "Indicado por (partner)", value: prospect.indicado_por_partner?.full_name },
    { label: "Indicado por (nome livre)", value: prospect.indicado_por_nome },
    { label: "Responsável", value: prospect.responsavel_nome },
    { label: "Notas", value: prospect.notas },
    { label: "Motivo de perda", value: prospect.motivo_perda },
    { label: "Link gerado em", value: prospect.link_gerado_em ? fmt(prospect.link_gerado_em) : null },
    { label: "Convertido em", value: prospect.convertido_em ? fmt(prospect.convertido_em) : null },
    { label: "Cadastrado em", value: fmt(prospect.created_at) },
  ].filter(r => r.value);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000090" }}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden flex flex-col max-h-[90vh]" style={{ background: "#0F1E35" }}>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-white/10 shrink-0">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: etapa?.color ?? MUTED }}>
              {etapa?.label ?? prospect.etapa}
            </p>
            <h3 className="text-base font-bold text-white">{prospect.nome}</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Conteúdo */}
        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          <div className="rounded-xl border border-white/5 overflow-hidden" style={{ background: NAVY_CARD }}>
            {rows.map((r, i) => (
              <div
                key={r.label}
                className={`flex gap-3 px-4 py-2.5 ${i < rows.length - 1 ? "border-b border-white/5" : ""}`}
              >
                <span className="text-[11px] font-semibold shrink-0 w-36" style={{ color: MUTED }}>{r.label}</span>
                <span className="text-[12px] text-white break-words">{r.value}</span>
              </div>
            ))}
          </div>

          {prospect.link_token && (
            <div className="rounded-xl border border-emerald-500/20 px-4 py-2.5 flex items-center gap-2" style={{ background: "#34D39910" }}>
              <Link2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[11px] font-semibold text-emerald-400">Link personalizado ativo</p>
                <p className="text-[10px]" style={{ color: MUTED }}>Token: {prospect.link_token}</p>
              </div>
            </div>
          )}

          {prospect.indicado_por_partner && (
            <div className="rounded-xl border px-4 py-2.5 flex items-center gap-2" style={{ background: `${GOLD}10`, borderColor: `${GOLD}30` }}>
              <Crown className="w-3.5 h-3.5 shrink-0" style={{ color: GOLD }} />
              <div>
                <p className="text-[11px] font-semibold" style={{ color: GOLD }}>Indicação de Partner</p>
                <p className="text-[10px]" style={{ color: MUTED }}>{prospect.indicado_por_partner.full_name} — comissão a ser gerada na conversão</p>
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-white/5 shrink-0">
          <button
            onClick={() => { onClose(); onEdit(prospect); }}
            className="flex-1 py-2 rounded-xl text-sm font-semibold border border-white/10 text-white hover:border-white/20 transition-colors flex items-center justify-center gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
          <button
            onClick={() => { onClose(); onLink(prospect); }}
            className="flex-1 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 border transition-colors"
            style={{ borderColor: `${GOLD}40`, color: GOLD }}
          >
            <Link2 className="w-3.5 h-3.5" /> Gerar Link
          </button>
          {isAdmin && (
            <button
              onClick={() => { onDelete(prospect.id); onClose(); }}
              className="py-2 px-3 rounded-xl text-sm border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Card do Kanban ──────────────────────────────────────────────────────────

function ProspectCard({
  prospect, onMove, onEdit, onLink, onDelete, onDetalhe, isAdmin,
}: {
  prospect: Prospect;
  onMove: (id: string, etapa: Etapa) => void;
  onEdit: (p: Prospect) => void;
  onLink: (p: Prospect) => void;
  onDelete: (id: string) => void;
  onDetalhe: (p: Prospect) => void;
  isAdmin: boolean;
}) {
  const etapaAtual = ETAPAS.findIndex(e => e.id === prospect.etapa);
  const podeMover = prospect.etapa !== "perdido";

  return (
    <div
      className="rounded-xl border border-white/5 p-3 space-y-2 hover:border-white/10 transition-colors cursor-pointer"
      style={{ background: "#0F1E35" }}
      onClick={() => onDetalhe(prospect)}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDetalhe(prospect); }}
          className="text-sm font-semibold text-white leading-tight text-left cursor-pointer hover:text-yellow-400 transition-colors"
        >
          {prospect.nome}
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onEdit(prospect); }} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Editar">
            <Pencil className="w-3 h-3" style={{ color: MUTED }} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onLink(prospect); }} className="p-1 rounded-lg hover:bg-white/10 transition-colors" title="Gerar Link">
            <Link2 className="w-3 h-3" style={{ color: GOLD }} />
          </button>
          {isAdmin && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(prospect.id); }} className="p-1 rounded-lg hover:bg-red-500/10 transition-colors" title="Excluir">
              <Trash2 className="w-3 h-3 text-red-400" />
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="space-y-1">
        {prospect.email && (
          <p className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>
            <Mail className="w-3 h-3 shrink-0" /> {prospect.email}
          </p>
        )}
        {prospect.telefone && (
          <p className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>
            <Phone className="w-3 h-3 shrink-0" /> {prospect.telefone}
          </p>
        )}
        {(prospect.cidade || prospect.estado) && (
          <p className="text-[11px] flex items-center gap-1" style={{ color: MUTED }}>
            <MapPin className="w-3 h-3 shrink-0" />
            {[prospect.cidade, prospect.estado].filter(Boolean).join(" — ")}
          </p>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1">
        <span
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `${origemColor(prospect.origem)}20`, color: origemColor(prospect.origem) }}
        >
          {origemLabel(prospect.origem)}
        </span>
        {prospect.indicado_por_partner && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${GOLD}20`, color: GOLD }}>
            <Crown className="w-2 h-2 inline mr-0.5" />
            {prospect.indicado_por_partner.full_name.split(" ")[0]}
          </span>
        )}
        {prospect.link_token && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
            Link ativo
          </span>
        )}
      </div>

      {/* Responsável */}
      {prospect.responsavel_nome && (
        <p className="text-[10px] flex items-center gap-1" style={{ color: MUTED }}>
          <User className="w-3 h-3" /> {prospect.responsavel_nome}
        </p>
      )}

      {/* Navegação de etapas */}
      {podeMover && (
        <div className="flex items-center justify-between pt-1 border-t border-white/5">
          <button
            onClick={(e) => { e.stopPropagation(); if (etapaAtual > 0) onMove(prospect.id, ETAPAS[etapaAtual - 1].id); }}
            disabled={etapaAtual === 0}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-20"
          >
            <ChevronLeft className="w-3 h-3" style={{ color: MUTED }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onMove(prospect.id, "perdido"); }}
            className="text-[9px] px-2 py-0.5 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            Perdido
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (etapaAtual < ETAPAS.length - 1) onMove(prospect.id, ETAPAS[etapaAtual + 1].id); }}
            disabled={etapaAtual === ETAPAS.length - 1}
            className="p-1 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-20"
          >
            <ChevronRight className="w-3 h-3" style={{ color: MUTED }} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Modal de Link Genérico (sem prospect) ────────────────────────────────────

function LinkGeralModal({ onClose }: { onClose: () => void }) {
  const baseUrl = typeof window !== "undefined"
    ? window.location.origin
    : "https://v3-partner.vercel.app";
  const url = `${baseUrl}/indicacao`;

  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const nome = "futuro partner";
  const whatsappMsg = encodeURIComponent(
    `Olá! 👋\n\nVocê foi convidado(a) para se tornar um Partner V3 Partners.\n\nAcesse o link abaixo para fazer seu cadastro gratuito e começar no período de trial de 30 dias:\n\n${url}\n\n*V3 Partners* — Boutique institucional multiproduto de securitização e estruturação financeira.`
  );
  const whatsappUrl = `https://wa.me/?text=${whatsappMsg}`;
  const emailSubject = encodeURIComponent("Convite V3 Partners — Torne-se um Partner");
  const emailBody = encodeURIComponent(
    `Olá,\n\nVocê foi convidado(a) para fazer parte da rede de partners V3 Partners.\n\nClique no link abaixo para realizar seu cadastro:\n${url}\n\nO trial é gratuito por 30 dias. Sem necessidade de cartão de crédito.\n\nEquipe V3 Partners`
  );
  const emailUrl = `mailto:?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000080" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: "#0F1E35" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div>
            <h3 className="text-base font-bold text-white">Link Geral de Cadastro</h3>
            <p className="text-xs mt-0.5" style={{ color: MUTED }}>Envie para qualquer pessoa — sem precisar cadastrar prospect</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="rounded-xl p-3 border border-white/10 flex items-center gap-2" style={{ background: NAVY_CARD }}>
            <p className="flex-1 text-xs text-white font-mono truncate">{url}</p>
            <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" style={{ color: GOLD }} />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: "#25D366" }}
            >
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
            <a
              href={emailUrl}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-opacity"
              style={{ background: "#4285F4" }}
            >
              <Mail className="w-4 h-4" /> E-mail
            </a>
          </div>
          <p className="text-[11px] text-center" style={{ color: MUTED }}>
            Para links personalizados por prospect, use o ícone 🔗 em cada card
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Link por Prospect ───────────────────────────────────────────────

function LinkModal({ prospect, onClose }: { prospect: Prospect; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string; whatsappUrl: string; emailUrl: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/prospeccao/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: prospect.id }),
    })
      .then(r => r.json())
      .then(j => {
        if (j.error) setErr(j.error);
        else setResult(j);
      })
      .catch(() => setErr("Erro ao gerar link"))
      .finally(() => setLoading(false));
  }, [prospect.id]);

  const copy = () => {
    if (!result?.url) return;
    navigator.clipboard.writeText(result.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "#00000080" }}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 overflow-hidden" style={{ background: "#0F1E35" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-base font-bold text-white">Link de Cadastro</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm" style={{ color: MUTED }}>
            Link personalizado para <span className="text-white font-semibold">{prospect.nome}</span>
          </p>

          {loading && (
            <div className="flex items-center justify-center h-16 gap-2" style={{ color: MUTED }}>
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
              <span className="text-sm">Gerando link…</span>
            </div>
          )}

          {err && <p className="text-sm text-red-400">{err}</p>}

          {result && (
            <>
              {/* URL */}
              <div className="rounded-xl p-3 border border-white/10 flex items-center gap-2" style={{ background: NAVY_CARD }}>
                <p className="flex-1 text-xs text-white font-mono truncate">{result.url}</p>
                <button onClick={copy} className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" style={{ color: GOLD }} />}
                </button>
              </div>

              {/* Botões de envio */}
              <div className="grid grid-cols-2 gap-3">
                <a
                  href={result.whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
                  style={{ background: "#25D366" }}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </a>
                <a
                  href={result.emailUrl}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors hover:opacity-90"
                  style={{ background: "#4285F4" }}
                >
                  <Mail className="w-4 h-4" />
                  E-mail
                </a>
              </div>

              <a
                href={result.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs"
                style={{ color: MUTED }}
              >
                <ExternalLink className="w-3 h-3" /> Visualizar página de cadastro
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────────

export function ProspeccaoClient({ role }: { role: string }) {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [equipe, setEquipe] = useState<Equipe[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filtroOrigem, setFiltroOrigem] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [linking, setLinking] = useState<Prospect | null>(null);
  const [showLinkGeral, setShowLinkGeral] = useState(false);
  const [detalhe, setDetalhe] = useState<Prospect | null>(null);
  const isAdmin = role === "ADMIN";

  const load = () => {
    setLoading(true); setErr(null);
    fetch("/api/prospeccao")
      .then(r => r.json())
      .then(j => {
        if (j.error) setErr(j.error);
        else {
          setProspects(j.leads ?? []);
          setEquipe(j.equipe ?? []);
          setPartners(j.partners ?? []);
        }
      })
      .catch(() => setErr("Erro ao carregar"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSave = async (data: Record<string, string>) => {
    if (editing) {
      const r = await fetch(`/api/prospeccao/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
    } else {
      const r = await fetch("/api/prospeccao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json());
      if (r.error) throw new Error(r.error);
    }
    setShowModal(false); setEditing(null);
    load();
  };

  const handleMove = async (id: string, etapa: Etapa) => {
    setProspects(ps => ps.map(p => p.id === id ? { ...p, etapa } : p));
    await fetch(`/api/prospeccao/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ etapa }),
    });
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este prospect?")) return;
    await fetch(`/api/prospeccao/${id}`, { method: "DELETE" });
    load();
  };

  const filtered = useMemo(() => {
    return prospects.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.nome.toLowerCase().includes(q) ||
        (p.email ?? "").toLowerCase().includes(q) ||
        (p.telefone ?? "").includes(q) ||
        (p.cidade ?? "").toLowerCase().includes(q);
      const matchOrigem = !filtroOrigem || p.origem === filtroOrigem;
      const matchResp = !filtroResp || p.responsavel_id === filtroResp;
      return matchSearch && matchOrigem && matchResp;
    });
  }, [prospects, search, filtroOrigem, filtroResp]);

  // KPIs
  const totalAtivos = prospects.filter(p => p.etapa !== "perdido").length;
  const convertidos = prospects.filter(p => p.etapa === "convertido").length;
  const taxaConversao = totalAtivos > 0 ? Math.round(convertidos / prospects.length * 100) : 0;
  const emTrial = prospects.filter(p => p.etapa === "trial").length;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">CRM de Prospecção</h1>
          <p className="text-xs mt-0.5" style={{ color: MUTED }}>Pipeline de captação de novos partners</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLinkGeral(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold border border-white/10 hover:border-white/20 transition-colors"
            style={{ color: GOLD }}
          >
            <Link2 className="w-4 h-4" /> Gerar Link
          </button>
          <button
            onClick={() => { setEditing(null); setShowModal(true); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-black"
            style={{ background: GOLD }}
          >
            <Plus className="w-4 h-4" /> Novo Prospect
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total no Funil", value: totalAtivos, icon: Target, color: "#60A5FA" },
          { label: "Em Trial", value: emTrial, icon: Users, color: "#A78BFA" },
          { label: "Convertidos", value: convertidos, icon: Crown, color: "#34D399" },
          { label: "Taxa de Conversão", value: `${taxaConversao}%`, icon: TrendingUp, color: GOLD },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-white/5 p-3 flex items-center gap-3" style={{ background: NAVY_CARD }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${k.color}20` }}>
              <k.icon className="w-4 h-4" style={{ color: k.color }} />
            </div>
            <div>
              <p className="text-lg font-bold text-white">{k.value}</p>
              <p className="text-[11px]" style={{ color: MUTED }}>{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: MUTED }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="pl-8 pr-3 py-1.5 text-sm rounded-xl border border-white/10 focus:outline-none focus:border-yellow-500/40"
            style={{ background: NAVY_CARD, color: "#fff" }}
          />
        </div>
        <select
          value={filtroOrigem}
          onChange={e => setFiltroOrigem(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-xl border border-white/10 focus:outline-none"
          style={{ background: NAVY_CARD, color: "#fff" }}
        >
          <option value="">Todas as origens</option>
          {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          value={filtroResp}
          onChange={e => setFiltroResp(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-xl border border-white/10 focus:outline-none"
          style={{ background: NAVY_CARD, color: "#fff" }}
        >
          <option value="">Todos responsáveis</option>
          {equipe.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
        </select>
        <button onClick={load} className="p-1.5 rounded-xl border border-white/10 hover:border-white/20 transition-colors">
          <RefreshCw className="w-4 h-4" style={{ color: MUTED }} />
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="flex items-center justify-center h-48 gap-2" style={{ color: MUTED }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: GOLD }} />
          <span className="text-sm">Carregando…</span>
        </div>
      )}

      {err && !loading && (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4" /> {err}
        </div>
      )}

      {/* Kanban */}
      {!loading && !err && (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {ETAPAS.map(etapa => {
            const cards = filtered.filter(p => p.etapa === etapa.id);
            return (
              <div key={etapa.id} className="shrink-0 w-64 space-y-3">
                {/* Coluna header */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: etapa.bg }}>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: etapa.color }}>
                    {etapa.label}
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: etapa.bg, color: etapa.color, border: `1px solid ${etapa.color}40` }}
                  >
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[120px]">
                  {cards.map(p => (
                    <ProspectCard
                      key={p.id}
                      prospect={p}
                      onMove={handleMove}
                      onEdit={p => { setEditing(p); setShowModal(true); }}
                      onLink={setLinking}
                      onDelete={handleDelete}
                      onDetalhe={setDetalhe}
                      isAdmin={isAdmin}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div className="h-16 rounded-xl border-2 border-dashed border-white/5 flex items-center justify-center">
                      <span className="text-[11px]" style={{ color: MUTED }}>Vazio</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Coluna Perdidos */}
          <div className="shrink-0 w-56 space-y-3">
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-red-500/10">
              <span className="text-xs font-bold uppercase tracking-widest text-red-400">Perdidos</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                {filtered.filter(p => p.etapa === "perdido").length}
              </span>
            </div>
            <div className="space-y-2 min-h-[60px]">
              {filtered.filter(p => p.etapa === "perdido").map(p => (
                <div key={p.id} className="rounded-xl border border-white/5 p-3" style={{ background: "#0F1E35" }}>
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-white leading-tight">{p.nome}</p>
                    {isAdmin && (
                      <button onClick={() => handleDelete(p.id)} className="p-0.5 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3 h-3" style={{ color: MUTED }} />
                      </button>
                    )}
                  </div>
                  {p.motivo_perda && (
                    <p className="text-[10px] mt-1" style={{ color: MUTED }}>{p.motivo_perda}</p>
                  )}
                  <button
                    onClick={() => handleMove(p.id, "prospect")}
                    className="mt-1.5 text-[10px] px-2 py-0.5 rounded-full border border-white/10 hover:border-white/20 transition-colors"
                    style={{ color: MUTED }}
                  >
                    Reativar
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <ProspectModal
          initial={editing}
          equipe={equipe}
          partners={partners}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditing(null); }}
        />
      )}

      {linking && (
        <LinkModal
          prospect={linking}
          onClose={() => setLinking(null)}
        />
      )}

      {showLinkGeral && (
        <LinkGeralModal onClose={() => setShowLinkGeral(false)} />
      )}

      {detalhe && (
        <DetalheModal
          prospect={detalhe}
          onClose={() => setDetalhe(null)}
          onEdit={p => { setDetalhe(null); setEditing(p); setShowModal(true); }}
          onLink={p => { setDetalhe(null); setLinking(p); }}
          onDelete={id => { handleDelete(id); setDetalhe(null); }}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
