"use client";

// Contatos da instituição: vários e-mails, UF do gerente de atendimento (ou Nacional), cargo,
// telefone e principal (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
import React, { useCallback, useEffect, useState } from "react";
import { Loader2, Mail, MapPin, Phone, Star } from "lucide-react";
import { BotaoV3, ModalV3 } from "@/components/integracao-api/modal-v3";
import { UFS, emailValido } from "@/lib/encaminhar-instituicao";

type Contato = { id: string; nome: string | null; email: string; uf: string | null; cargo: string; telefone: string | null; principal: boolean };
type Form = { id?: string; nome: string; email: string; uf: string; cargo: string; telefone: string; principal: boolean };
const VAZIO: Form = { nome: "", email: "", uf: "", cargo: "Gerente de atendimento", telefone: "", principal: false };

/** Telefone digitado vira E.164; número brasileiro sem DDI ganha +55. */
export function telefoneE164(v: string): string | null {
  const t = v.trim();
  if (!t) return null;
  const d = t.replace(/\D/g, "");
  if (t.startsWith("+")) return `+${d}`;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  return `+${d}`;
}
export function telefoneExibir(e164: string | null): string {
  if (!e164) return "";
  const m = /^\+55(\d{2})(\d{4,5})(\d{4})$/.exec(e164);
  return m ? `+55 (${m[1]}) ${m[2]}-${m[3]}` : e164;
}

export function ContatosInstituicao({ instituicaoId, canManage }: { instituicaoId: string; canManage: boolean }) {
  const [lista, setLista] = useState<Contato[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [remover, setRemover] = useState<Contato | null>(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/instituicoes/${instituicaoId}/contatos`, { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) { setErro(j?.error ?? "Não foi possível carregar os contatos."); return; }
    setLista(j.contatos);
  }, [instituicaoId]);
  useEffect(() => { void carregar(); }, [carregar]);

  async function salvar() {
    if (!form) return;
    setSalvando(true); setErro(null);
    const corpo = { nome: form.nome.trim() || null, email: form.email.trim().toLowerCase(), uf: form.uf || null, cargo: form.cargo.trim() || "Gerente de atendimento", telefone: telefoneE164(form.telefone), principal: form.principal };
    const url = form.id ? `/api/instituicoes/contatos/${form.id}` : `/api/instituicoes/${instituicaoId}/contatos`;
    const r = await fetch(url, { method: form.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setSalvando(false);
    if (!r?.ok) { setErro(j.error ?? "Não foi possível salvar."); return; }
    setForm(null);
    void carregar();
  }

  async function confirmarRemocao() {
    if (!remover) return;
    const r = await fetch(`/api/instituicoes/contatos/${remover.id}`, { method: "DELETE" }).catch(() => null);
    if (!r?.ok) setErro("Não foi possível remover o contato.");
    setRemover(null);
    void carregar();
  }

  const campo = "w-full h-8 px-2.5 text-xs bg-[#09081A] border border-[#243A66] rounded-lg text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]";

  return (
    <div className="bg-[#111F35] border border-[#243A66] rounded-xl p-3.5 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-bold text-[#C9A84C] uppercase tracking-widest">Contatos para encaminhamento</p>
        {canManage && !form && <button onClick={() => setForm({ ...VAZIO })} className="text-[11px] font-semibold text-[#E8C97A] hover:underline">Adicionar contato</button>}
      </div>
      {lista === null ? (erro ? <p className="text-xs text-red-300">{erro}</p> : <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C9A84C]" />)
        : lista.length === 0 && !form ? <p className="text-xs text-muted-foreground italic">Nenhum contato. Adicione pelo menos um e-mail para encaminhar propostas a esta instituição.</p>
        : lista.map((c) => (
          <div key={c.id} className="flex items-start justify-between gap-2 py-1.5 border-b border-[#162744] last:border-0">
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs text-foreground flex items-center gap-1.5">{c.principal && <Star className="w-3 h-3 text-[#C9A84C]" aria-label="Principal" />}{c.nome ?? "(sem nome)"} <span className="text-muted-foreground">· {c.cargo}</span></p>
              <p className="text-xs text-foreground flex items-center gap-1.5 break-all"><Mail className="w-3 h-3 text-muted-foreground flex-shrink-0" /> {c.email}</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-3"><span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {c.uf ?? "Nacional"}</span>{c.telefone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {telefoneExibir(c.telefone)}</span>}</p>
            </div>
            {canManage && (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => setForm({ id: c.id, nome: c.nome ?? "", email: c.email, uf: c.uf ?? "", cargo: c.cargo, telefone: telefoneExibir(c.telefone), principal: c.principal })} className="text-[11px] text-[#E8C97A] hover:underline">Editar</button>
                <button onClick={() => setRemover(c)} className="text-[11px] text-red-300 hover:underline">Remover</button>
              </div>
            )}
          </div>
        ))}

      {form && (
        <div className="space-y-2 pt-2 border-t border-[#162744]">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[10px] text-muted-foreground col-span-2" htmlFor={`ct-email-${instituicaoId}`}>E-mail *
              <input id={`ct-email-${instituicaoId}`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={`${campo} ${form.email && !emailValido(form.email) ? "border-red-500/60" : ""}`} placeholder="gerente@instituicao.com.br" />
            </label>
            <label className="text-[10px] text-muted-foreground" htmlFor={`ct-nome-${instituicaoId}`}>Nome
              <input id={`ct-nome-${instituicaoId}`} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={campo} />
            </label>
            <label className="text-[10px] text-muted-foreground" htmlFor={`ct-cargo-${instituicaoId}`}>Cargo
              <input id={`ct-cargo-${instituicaoId}`} value={form.cargo} onChange={(e) => setForm({ ...form, cargo: e.target.value })} className={campo} />
            </label>
            <label className="text-[10px] text-muted-foreground" htmlFor={`ct-uf-${instituicaoId}`}>UF do gerente
              <select id={`ct-uf-${instituicaoId}`} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value })} className={campo}>
                <option value="">Nacional</option>
                {[...UFS].sort((a, b) => a.localeCompare(b, "pt-BR")).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="text-[10px] text-muted-foreground" htmlFor={`ct-tel-${instituicaoId}`}>Telefone
              <input id={`ct-tel-${instituicaoId}`} value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={campo} placeholder="+55 (11) 98765-4321" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer" htmlFor={`ct-princ-${instituicaoId}`}>
            <input id={`ct-princ-${instituicaoId}`} type="checkbox" checked={form.principal} onChange={(e) => setForm({ ...form, principal: e.target.checked })} className="accent-[#C9A84C]" /> Contato principal
          </label>
          <div className="flex gap-2">
            <BotaoV3 tipo="primario" disabled={salvando || !emailValido(form.email)} onClick={salvar}>{salvando ? "Salvando..." : "Salvar contato"}</BotaoV3>
            <BotaoV3 onClick={() => { setForm(null); setErro(null); }}>Cancelar</BotaoV3>
          </div>
        </div>
      )}
      {erro && lista !== null && <p className="text-xs text-red-300">{erro}</p>}

      <ModalV3 aberto={!!remover} perigo titulo={`Remover o contato ${remover?.nome ?? remover?.email ?? ""}?`}
        rodape={<><BotaoV3 onClick={() => setRemover(null)}>Cancelar</BotaoV3><BotaoV3 tipo="perigo" onClick={confirmarRemocao}>Remover</BotaoV3></>}>
        <p>Ele deixa de aparecer nos próximos envios. Envios já feitos continuam no histórico.</p>
      </ModalV3>
    </div>
  );
}
