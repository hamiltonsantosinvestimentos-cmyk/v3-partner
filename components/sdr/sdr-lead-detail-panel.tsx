"use client";

import { useState } from "react";

export type SdrLead = {
  phone: string;
  nome: string | null;
  tags: string[];
  responsavel_id: string | null;
  responsavel_nome: string | null;
  status: string;
  humano_ativo: boolean;
  last_message_at: string | null;
  last_message_preview: string | null;
  message_count: number;
  prospeccao_etapa: string | null;
};

type Profile = { id: string; full_name: string; role: string };

export const PROSPECCAO_ETAPA_LABELS: Record<string, { label: string; text: string; bg: string; border: string }> = {
  prospect:    { label: "Prospect",    text: "text-[#7A8FA8]",   bg: "bg-[#7A8FA8]/10",   border: "border-[#7A8FA8]/30" },
  contatado:   { label: "Contatado",   text: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/30" },
  interessado: { label: "Interessado", text: "text-amber-400",   bg: "bg-amber-400/10",   border: "border-amber-400/30" },
  trial:       { label: "Em Trial",    text: "text-violet-400",  bg: "bg-violet-400/10",  border: "border-violet-400/30" },
  convertido:  { label: "Convertido",  text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
  perdido:     { label: "Perdido",     text: "text-red-400",     bg: "bg-red-400/10",     border: "border-red-400/30" },
};

const PRESET_TAGS = ["Hot Lead", "Qualificado", "Partner", "Investidor", "Agendado", "Em Negociação", "Sem Interesse", "Aguardando"];

const STATUS_OPTIONS = [
  { value: "ativo", label: "Ativo" },
  { value: "qualificado", label: "Qualificado" },
  { value: "agendado", label: "Agendado" },
  { value: "convertido", label: "Convertido" },
  { value: "sem_interesse", label: "Sem Interesse" },
  { value: "arquivado", label: "Arquivado" },
];

export function tagClass(tag: string): string {
  if (["Hot Lead", "Agendado"].includes(tag))
    return "bg-[#C9A84C]/10 border-[#C9A84C]/40 text-[#C9A84C]";
  if (["Qualificado", "Partner", "Investidor", "Em Negociação"].includes(tag))
    return "bg-[#243A66] border-[#243A66] text-[#F0ECE4]";
  return "bg-[#111F35] border-[#243A66] text-[#7A8FA8]";
}

export function statusClass(status: string): { label: string; text: string; bg: string; border: string } {
  const map: Record<string, { label: string; text: string; bg: string; border: string }> = {
    ativo:         { label: "Ativo",         text: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
    qualificado:   { label: "Qualificado",   text: "text-[#C9A84C]",   bg: "bg-[#C9A84C]/10",    border: "border-[#C9A84C]/30" },
    agendado:      { label: "Agendado",      text: "text-blue-400",    bg: "bg-blue-400/10",     border: "border-blue-400/30" },
    convertido:    { label: "Convertido",    text: "text-emerald-400", bg: "bg-emerald-400/20",  border: "border-emerald-400/40" },
    sem_interesse: { label: "Sem Interesse", text: "text-[#7A8FA8]",   bg: "bg-[#243A66]",        border: "border-[#243A66]" },
    arquivado:     { label: "Arquivado",     text: "text-[#7A8FA8]",   bg: "bg-[#111F35]",        border: "border-[#243A66]" },
  };
  return map[status] ?? map.ativo;
}

// key={lead.phone} no componente pai garante remount (e reset dos estados locais) a cada troca de lead
export function SdrLeadDetailPanel({
  lead, profiles, currentUserId, currentUserName, savingLead, onPatch,
}: {
  lead: SdrLead;
  profiles: Profile[];
  currentUserId: string;
  currentUserName: string;
  savingLead: boolean;
  onPatch: (patch: Partial<SdrLead> & { phone: string }) => void;
}) {
  const [editNome, setEditNome] = useState(false);
  const [nomeInput, setNomeInput] = useState(lead.nome ?? "");
  const [editTag, setEditTag] = useState(false);

  const sb = statusClass(lead.status);
  const pe = lead.prospeccao_etapa ? PROSPECCAO_ETAPA_LABELS[lead.prospeccao_etapa] : null;

  function toggleTag(tag: string) {
    const current = lead.tags ?? [];
    const next = current.includes(tag) ? current.filter(t => t !== tag) : [...current, tag];
    onPatch({ phone: lead.phone, tags: next });
  }

  function saveNome() {
    onPatch({ phone: lead.phone, nome: nomeInput.trim() || (null as unknown as string) });
    setEditNome(false);
  }

  return (
    <div className="w-72 shrink-0 bg-[#111F35] border-l border-[#243A66] overflow-y-auto p-4 space-y-5">
      {/* Avatar + nome */}
      <div className="flex flex-col items-center text-center gap-2 pb-4 border-b border-[#243A66]">
        <div className="w-16 h-16 rounded-full bg-[#C9A84C]/10 border-2 border-[#C9A84C] flex items-center justify-center text-[#C9A84C] font-bold text-xl">
          {lead.nome ? lead.nome.split(" ").slice(0, 2).map(n => n[0]).join("").toUpperCase() : lead.phone.slice(-2)}
        </div>
        {editNome ? (
          <div className="flex gap-1.5 items-center">
            <input
              autoFocus
              value={nomeInput}
              onChange={e => setNomeInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveNome(); if (e.key === "Escape") setEditNome(false); }}
              placeholder="Nome do contato..."
              className="px-2 py-1 text-sm rounded-lg bg-[#0A1628] border border-[#C9A84C] text-[#F0ECE4] focus:outline-none"
            />
            <button onClick={saveNome} className="bg-[#C9A84C] rounded-md px-2 py-1 text-[#09081A] font-bold text-xs">✓</button>
            <button onClick={() => setEditNome(false)} className="bg-[#243A66] rounded-md px-2 py-1 text-[#7A8FA8] text-xs">✕</button>
          </div>
        ) : (
          <p
            onClick={() => { setEditNome(true); setNomeInput(lead.nome ?? ""); }}
            className="text-[#F0ECE4] font-bold text-base cursor-pointer"
            title="Clique para editar nome"
          >
            {lead.nome ?? lead.phone}
          </p>
        )}
        <p className="text-[#7A8FA8] text-xs">{lead.phone}</p>
      </div>

      {/* Status */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] mb-1.5">Status</p>
        <select
          value={lead.status}
          onChange={e => onPatch({ phone: lead.phone, status: e.target.value })}
          disabled={savingLead}
          className={`w-full text-xs font-bold rounded-lg px-2.5 py-1.5 border ${sb.bg} ${sb.text} ${sb.border} focus:outline-none`}
        >
          {STATUS_OPTIONS.map(s => (
            <option key={s.value} value={s.value} className="bg-[#162744] text-[#F0ECE4]">{s.label}</option>
          ))}
        </select>
      </div>

      {/* Etapa de Prospecção */}
      {pe && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] mb-1.5">Prospecção de Partners</p>
          <span title="Etapa vinculada no Kanban de Prospecção de Partners" className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full border ${pe.bg} ${pe.text} ${pe.border}`}>
            ↗ {pe.label}
          </span>
        </div>
      )}

      {/* Tags */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Tags</p>
          <button onClick={() => setEditTag(!editTag)} className="text-[10px] text-[#7A8FA8] border border-dashed border-[#243A66] rounded px-1.5 py-0.5 hover:text-[#F0ECE4] hover:border-[#3A5070] transition-colors">
            + Tag
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(lead.tags ?? []).length === 0 && !editTag && (
            <p className="text-xs text-[#7A8FA8]">Nenhuma tag</p>
          )}
          {(lead.tags ?? []).map(tag => (
            <span
              key={tag}
              onClick={() => toggleTag(tag)}
              title="Clique para remover"
              className={`text-[10px] font-bold px-2 py-1 rounded cursor-pointer border ${tagClass(tag)}`}
            >
              {tag} ×
            </span>
          ))}
        </div>
        {editTag && (
          <div className="mt-2 flex flex-wrap gap-1.5 bg-[#0A1628] border border-[#243A66] rounded-xl p-2">
            {PRESET_TAGS.map(tag => {
              const active = (lead.tags ?? []).includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-[11px] font-semibold px-2 py-1 rounded border ${active ? tagClass(tag) : "bg-[#111F35] border-[#243A66] text-[#7A8FA8]"}`}
                >
                  {active ? "✓ " : ""}{tag}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Responsável */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C] mb-1.5">Responsável</p>
        <div className="flex gap-1.5 items-center">
          <select
            value={lead.responsavel_id ?? ""}
            onChange={e => onPatch({ phone: lead.phone, responsavel_id: e.target.value })}
            disabled={savingLead}
            className="flex-1 px-2.5 py-1.5 text-xs rounded-lg bg-[#0A1628] border border-[#243A66] text-[#F0ECE4] focus:outline-none"
          >
            <option value="" className="bg-[#162744]">Sem responsável</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id} className="bg-[#162744] text-[#F0ECE4]">{p.full_name}</option>
            ))}
          </select>
          {!lead.responsavel_id && (
            <button
              onClick={() => onPatch({ phone: lead.phone, responsavel_id: currentUserId })}
              title={`Atribuir a ${currentUserName}`}
              className="text-[11px] font-semibold text-[#C9A84C] bg-[#C9A84C]/10 border border-[#C9A84C] rounded-md px-2 py-1.5 whitespace-nowrap"
            >
              Eu
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
