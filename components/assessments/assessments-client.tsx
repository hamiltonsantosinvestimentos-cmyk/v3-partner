"use client";

import { useState } from "react";
import { ClipboardCheck, Calendar, Building2, TrendingUp, Plus, ChevronRight, AlertCircle } from "lucide-react";

const INSTRUMENTO_LABEL: Record<string, { label: string; color: string }> = {
  CRI_VERDE:      { label: "CRI Verde",        color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  TOKEN_RWA:      { label: "Token RWA",         color: "bg-[#C9A84C]/15 text-[#C9A84C] border-[#C9A84C]/30" },
  FIDC_ESG:       { label: "FIDC ESG",          color: "bg-blue-500/15 text-blue-400 border-blue-500/30" },
  EQUITY_TOKEN:   { label: "Equity Token",      color: "bg-purple-500/15 text-purple-400 border-purple-500/30" },
  MA_ESTRUTURADO: { label: "M&A Estruturado",   color: "bg-orange-500/15 text-orange-400 border-orange-500/30" },
  INDEFINIDO:     { label: "A definir",         color: "bg-[#9BAFC5]/15 text-[#9BAFC5] border-[#9BAFC5]/30" },
};

const STATUS_LABEL: Record<string, string> = {
  rascunho:   "Rascunho",
  completo:   "Completo",
  em_analise: "Em análise",
  promovido:  "Promovido",
  descartado: "Descartado",
};

type Assessment = {
  id: string;
  empresa_nome: string;
  lead_nome: string;
  lead_email?: string;
  instrumento_recomendado: string;
  score_qualificacao: number;
  diagnostico_notas?: string;
  status: string;
  origem: string;
  created_at: string;
};

type Meeting = {
  id: string;
  empresa_nome: string;
  contato_nome: string;
  meeting_date: string;
  meeting_type: string;
  status: string;
  proximo_passo?: string;
  deal_assessments?: { empresa_nome: string; instrumento_recomendado: string } | null;
};

interface Props {
  assessments: Assessment[];
  meetings: Meeting[];
  role: string;
  userId: string;
}

export function AssessmentsClient({ assessments, meetings, role }: Props) {
  const [tab, setTab] = useState<"assessments" | "meetings">("assessments");
  const [showNewMeeting, setShowNewMeeting] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    empresa_nome: "", contato_nome: "", contato_email: "",
    meeting_date: "", meeting_type: "remoto", pauta: "", notas: "",
    proximo_passo: "", assessment_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const canEdit = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role);

  async function saveMeeting() {
    setSaving(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newMeeting),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg("Reunião registrada.");
        setShowNewMeeting(false);
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMsg(json.error ?? "Erro ao salvar.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-700 text-[#F5F1E8]">Qualificação de Clientes</h1>
          <p className="text-sm text-[#9BAFC5] mt-1">Assessments de tokenização e registro de reuniões</p>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowNewMeeting(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-600 hover:bg-[#E8C97A] transition-colors"
          >
            <Plus size={14} />
            Nova Reunião
          </button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { icon: ClipboardCheck, label: "Total Assessments", value: assessments.length },
          { icon: TrendingUp, label: "Em Análise", value: assessments.filter(a => a.status === "em_analise").length },
          { icon: Building2, label: "Promovidos", value: assessments.filter(a => a.status === "promovido").length },
          { icon: Calendar, label: "Reuniões", value: meetings.length },
        ].map(({ icon: Icon, label, value }) => (
          <div key={label} className="bg-[#162744] border border-[#243A66] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon size={14} className="text-[#C9A84C]" />
              <span className="text-[10px] font-700 uppercase tracking-widest text-[#E8C97A]">{label}</span>
            </div>
            <p className="text-2xl font-700 text-[#F5F1E8]">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[#13223A] rounded-lg p-1 w-fit">
        {(["assessments", "meetings"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-500 transition-all ${
              tab === t
                ? "bg-[#162744] text-[#F5F1E8] shadow"
                : "text-[#9BAFC5] hover:text-[#F5F1E8]"
            }`}
          >
            {t === "assessments" ? "Assessments" : "Reuniões"}
          </button>
        ))}
      </div>

      {/* Assessments Tab */}
      {tab === "assessments" && (
        <div className="space-y-2">
          {assessments.length === 0 ? (
            <EmptyState icon={ClipboardCheck} text="Nenhum assessment ainda. O formulário do site alimenta esta lista automaticamente." />
          ) : assessments.map(a => (
            <div key={a.id} className="bg-[#162744] border border-[#243A66] rounded-xl p-4 hover:border-[#C9A84C]/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-600 text-[#F5F1E8] truncate">{a.empresa_nome}</span>
                    <InstrumentoBadge instrumento={a.instrumento_recomendado} />
                    <span className="text-[10px] font-700 uppercase tracking-wider text-[#9BAFC5] bg-[#09081A] px-2 py-0.5 rounded">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                  <p className="text-xs text-[#9BAFC5]">{a.lead_nome} · {a.lead_email ?? "sem email"}</p>
                  {a.diagnostico_notas && (
                    <p className="text-xs text-[#9BAFC5]/80 mt-2 line-clamp-2">{a.diagnostico_notas}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <ScoreBadge score={a.score_qualificacao} />
                  <span className="text-[10px] text-[#9BAFC5]/60">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
                  <ChevronRight size={14} className="text-[#9BAFC5]/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Meetings Tab */}
      {tab === "meetings" && (
        <div className="space-y-2">
          {meetings.length === 0 ? (
            <EmptyState icon={Calendar} text="Nenhuma reunião registrada. Clique em 'Nova Reunião' para começar." />
          ) : meetings.map(m => (
            <div key={m.id} className="bg-[#162744] border border-[#243A66] rounded-xl p-4 hover:border-[#C9A84C]/30 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-600 text-[#F5F1E8]">{m.empresa_nome}</span>
                    <span className="text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded border" style={{
                      background: m.status === "realizada" ? "rgba(16,185,129,.12)" : "rgba(201,168,76,.12)",
                      color: m.status === "realizada" ? "#10b981" : "#C9A84C",
                      borderColor: m.status === "realizada" ? "rgba(16,185,129,.3)" : "rgba(201,168,76,.3)",
                    }}>
                      {m.status}
                    </span>
                    {m.deal_assessments && (
                      <InstrumentoBadge instrumento={m.deal_assessments.instrumento_recomendado} />
                    )}
                  </div>
                  <p className="text-xs text-[#9BAFC5]">{m.contato_nome} · {m.meeting_type} · {new Date(m.meeting_date).toLocaleDateString("pt-BR")}</p>
                  {m.proximo_passo && (
                    <p className="text-xs text-[#C9A84C]/80 mt-1.5 flex items-center gap-1">
                      <ChevronRight size={10} /> {m.proximo_passo}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova Reunião */}
      {showNewMeeting && (
        <div className="fixed inset-0 bg-[#09081A]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#162744] border border-[#243A66] rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-700 text-[#F5F1E8]">Nova Reunião</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Empresa" required>
                <input value={newMeeting.empresa_nome} onChange={e => setNewMeeting(p => ({ ...p, empresa_nome: e.target.value }))} className={INPUT_CLASS} placeholder="DABion Soluções..." />
              </Field>
              <Field label="Contato" required>
                <input value={newMeeting.contato_nome} onChange={e => setNewMeeting(p => ({ ...p, contato_nome: e.target.value }))} className={INPUT_CLASS} placeholder="Douglas Batista" />
              </Field>
              <Field label="Email do Contato">
                <input type="email" value={newMeeting.contato_email} onChange={e => setNewMeeting(p => ({ ...p, contato_email: e.target.value }))} className={INPUT_CLASS} placeholder="douglas@..." />
              </Field>
              <Field label="Data" required>
                <input type="date" value={newMeeting.meeting_date} onChange={e => setNewMeeting(p => ({ ...p, meeting_date: e.target.value }))} className={INPUT_CLASS} />
              </Field>
              <Field label="Tipo">
                <select value={newMeeting.meeting_type} onChange={e => setNewMeeting(p => ({ ...p, meeting_type: e.target.value }))} className={INPUT_CLASS}>
                  <option value="presencial">Presencial</option>
                  <option value="remoto">Remoto (video)</option>
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </Field>
              <Field label="Assessment relacionado">
                <select value={newMeeting.assessment_id} onChange={e => setNewMeeting(p => ({ ...p, assessment_id: e.target.value }))} className={INPUT_CLASS}>
                  <option value="">Nenhum</option>
                  {assessments.map(a => (
                    <option key={a.id} value={a.id}>{a.empresa_nome}</option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Pauta">
              <textarea value={newMeeting.pauta} onChange={e => setNewMeeting(p => ({ ...p, pauta: e.target.value }))} className={INPUT_CLASS + " h-20 resize-none"} placeholder="Estruturação da usina, tokenização de créditos de carbono..." />
            </Field>
            <Field label="Próximo passo">
              <input value={newMeeting.proximo_passo} onChange={e => setNewMeeting(p => ({ ...p, proximo_passo: e.target.value }))} className={INPUT_CLASS} placeholder="Enviar proposta até 30/05" />
            </Field>
            {msg && (
              <p className={`text-xs flex items-center gap-1 ${msg.includes("Erro") ? "text-red-400" : "text-emerald-400"}`}>
                <AlertCircle size={12} /> {msg}
              </p>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={saveMeeting} disabled={saving} className="flex-1 py-2.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-600 hover:bg-[#E8C97A] disabled:opacity-50 transition-colors">
                {saving ? "Salvando..." : "Registrar Reunião"}
              </button>
              <button onClick={() => setShowNewMeeting(false)} className="px-4 py-2.5 rounded-lg border border-[#243A66] text-[#9BAFC5] text-sm hover:border-[#C9A84C]/40 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const INPUT_CLASS = "w-full bg-[#09081A] border border-[#243A66] rounded-lg px-3 py-2 text-sm text-[#F5F1E8] placeholder-[#9BAFC5]/50 focus:outline-none focus:border-[#C9A84C]/50";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-700 uppercase tracking-widest text-[#E8C97A]">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

function InstrumentoBadge({ instrumento }: { instrumento: string }) {
  const { label, color } = INSTRUMENTO_LABEL[instrumento] ?? INSTRUMENTO_LABEL.INDEFINIDO;
  return (
    <span className={`text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded border ${color}`}>
      {label}
    </span>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 4 ? "#10b981" : score >= 2 ? "#C9A84C" : "#9BAFC5";
  return (
    <div className="flex items-center gap-1">
      {[1,2,3,4,5].map(i => (
        <div key={i} className="w-1.5 h-4 rounded-sm" style={{ background: i <= score ? color : "rgba(155,175,197,.2)" }} />
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="bg-[#162744] border border-[#243A66] border-dashed rounded-xl p-10 text-center">
      <Icon size={28} className="text-[#9BAFC5]/40 mx-auto mb-3" />
      <p className="text-sm text-[#9BAFC5]/60">{text}</p>
    </div>
  );
}
