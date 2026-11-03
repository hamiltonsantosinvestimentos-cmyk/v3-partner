"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, Send } from "lucide-react";
import { maskCurrencyBRLInput, parseCurrencyBRLInput, valorParaCampoBRL } from "@/lib/utils";
import {
  avisosPreAprovacao, brl, dataHoraBR, mascararEmail, proximaEtapaTexto, validarPreAprovacao,
  type PreAprovacaoDados, type PreAprovacaoRegistro,
} from "@/lib/pre-aprovacao";

// Pré-aprovação da proposta (BRIEF 2026-11-03_pre-aprovacao-mesa-operacional.md): a Mesa preenche à mão e
// envia por e-mail ao cliente e ao partner. Só a equipe vê; a rota repete a checagem de papel.

type Meta = Record<string, unknown>;
type Campo = "renda_apresentada" | "renda_aprovada" | "valor_pre_aprovado" | "valor_imovel" | "valor_pretendido";

const CAMPOS: { k: Campo; label: string }[] = [
  { k: "renda_apresentada", label: "Renda média apresentada" },
  { k: "renda_aprovada", label: "Renda média aprovada pela instituição" },
  { k: "valor_pre_aprovado", label: "Valor pré-aprovado com a renda do cliente" },
  { k: "valor_imovel", label: "Valor do imóvel" },
  { k: "valor_pretendido", label: "Valor pretendido" },
];

export function PreAprovacaoPanel({ proposalId, clientEmail, partnerName, hasPartner, metadata, onMetadata }: {
  proposalId: string;
  clientEmail: string | null;
  partnerName: string | null;
  hasPartner: boolean;
  metadata: Meta | null | undefined;
  onMetadata: (m: Meta) => void;
}) {
  const atual = (metadata?.pre_aprovacao ?? null) as PreAprovacaoRegistro | null;
  const historico = (Array.isArray(metadata?.pre_aprovacao_historico) ? metadata!.pre_aprovacao_historico : []) as PreAprovacaoRegistro[];
  const [editando, setEditando] = useState(false);
  const [valores, setValores] = useState<Record<Campo, string>>(() => Object.fromEntries(CAMPOS.map((c) => [c.k, atual ? valorParaCampoBRL(atual[c.k]) : ""])) as Record<Campo, string>);
  const [etapa, setEtapa] = useState(() => ({
    avaliacao: atual?.proxima_etapa.avaliacao ?? false,
    contrato: atual?.proxima_etapa.contrato ?? false,
    outros: atual?.proxima_etapa.outros ?? false,
    outros_texto: atual?.proxima_etapa.outros_texto ?? "",
  }));
  const [confirmando, setConfirmando] = useState<PreAprovacaoDados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const emailOk = !!clientEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail);

  function revisar() {
    setErro(null);
    const corpo = { ...Object.fromEntries(CAMPOS.map((c) => [c.k, parseCurrencyBRLInput(valores[c.k])])), proxima_etapa: etapa };
    const v = validarPreAprovacao(corpo);
    if (!v.ok) { setErro(v.erros.join(" ")); return; }
    setConfirmando(v.dados);
  }

  async function enviar() {
    if (!confirmando) return;
    setEnviando(true); setErro(null);
    try {
      const r = await fetch(`/api/credit-proposals/${proposalId}/pre-aprovacao`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(confirmando),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(j.error ?? "Não foi possível enviar."); return; }
      onMetadata(j.metadata as Meta);
      setAviso(j.aviso ?? null);
      setConfirmando(null); setEditando(false);
    } finally { setEnviando(false); }
  }

  const input = "w-full h-9 rounded-lg bg-[#111F35] border border-[#243A66] px-3 text-sm text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]";

  return (
    <div className="rounded-xl border border-[#243A66] bg-[#162744] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BadgeCheck className="w-4 h-4 text-[#C9A84C]" />
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#C9A84C]">Pré-aprovação</p>
        </div>
        {!editando && (
          <button onClick={() => { setEditando(true); setAviso(null); }} disabled={!emailOk}
            className="h-8 px-3 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-[#C9A84C] text-xs font-semibold hover:bg-[#C9A84C]/20 disabled:opacity-40">
            {atual ? "Reenviar com correção" : "Registrar pré-aprovação"}
          </button>
        )}
      </div>

      {!emailOk && <p className="text-xs text-[#E8C97A]">Cadastre o e-mail do cliente na proposta para enviar a pré-aprovação.</p>}
      {emailOk && !hasPartner && <p className="text-xs text-[#7A8FA8]">Proposta sem partner: só o cliente receberá o e-mail.</p>}

      {!atual && !editando && <p className="text-sm text-[#7A8FA8]">Nenhuma pré-aprovação registrada.</p>}

      {atual && !editando && (
        <div className="space-y-1 text-sm">
          {CAMPOS.map((c) => (
            <div key={c.k} className="flex justify-between gap-4"><span className="text-[#7A8FA8]">{c.label}</span><span className="text-[#F0ECE4] font-semibold">{brl(atual[c.k])}</span></div>
          ))}
          <p className="text-[#F0ECE4]"><span className="text-[#7A8FA8]">Próxima etapa:</span> {proximaEtapaTexto(atual.proxima_etapa).join("; ")}</p>
          <p className="text-xs text-[#7A8FA8]">Enviado em {dataHoraBR(atual.enviado_em)} por {atual.enviado_por_nome ?? "equipe V3"} para {atual.emails.partner ? "cliente e partner" : "cliente"}.</p>
        </div>
      )}
      {aviso && <p className="text-xs text-[#E8C97A]">{aviso}</p>}

      {editando && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CAMPOS.map((c) => (
              <label key={c.k} className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">{c.label}</span>
                <input inputMode="numeric" className={input} placeholder="R$ 0,00" value={valores[c.k] ? `R$ ${valores[c.k]}` : ""}
                  onChange={(e) => setValores((v) => ({ ...v, [c.k]: maskCurrencyBRLInput(e.target.value) }))} />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#7A8FA8]">Próxima etapa</p>
            {([["avaliacao", "Avaliação de imóvel"], ["contrato", "Assinatura de contrato"], ["outros", "Outros"]] as const).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm text-[#F0ECE4]">
                <input type="checkbox" checked={etapa[k]} onChange={(e) => setEtapa((s) => ({ ...s, [k]: e.target.checked }))} className="accent-[#C9A84C]" />
                {l}
              </label>
            ))}
            {etapa.outros && (
              <input className={input} maxLength={300} placeholder="Qual a próxima etapa" value={etapa.outros_texto}
                onChange={(e) => setEtapa((s) => ({ ...s, outros_texto: e.target.value }))} />
            )}
          </div>
          {erro && !confirmando && <p className="text-xs text-red-400">{erro}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setEditando(false); setErro(null); }} className="h-9 px-4 rounded-lg border border-[#243A66] text-sm text-[#7A8FA8]">Cancelar</button>
            <button onClick={revisar} className="h-9 px-4 rounded-lg bg-[#C9A84C] text-[#09081A] text-sm font-bold flex items-center gap-2"><Send className="w-4 h-4" /> Revisar e enviar</button>
          </div>
        </div>
      )}

      {historico.length > 0 && !editando && (
        <details className="text-xs text-[#7A8FA8]">
          <summary className="cursor-pointer">Envios anteriores ({historico.length})</summary>
          <ul className="mt-2 space-y-1">
            {historico.map((h, i) => (
              <li key={i}>{dataHoraBR(h.enviado_em)}: pré-aprovado {brl(h.valor_pre_aprovado)}, por {h.enviado_por_nome ?? "equipe V3"}</li>
            ))}
          </ul>
        </details>
      )}

      {confirmando && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border-2 border-red-500/60 bg-[#111F35] p-5 space-y-3">
            <p className="text-base font-bold text-[#F0ECE4]">Enviar a pré-aprovação</p>
            <p className="text-sm text-[#F0ECE4]">
              Enviar a pré-aprovação para o cliente ({mascararEmail(clientEmail ?? "")}){hasPartner ? ` e para o partner (${partnerName ?? "partner"})` : ""}? Depois de enviado, o e-mail não pode ser desfeito.
            </p>
            <div className="rounded-lg bg-[#162744] p-3 space-y-1 text-sm">
              {CAMPOS.map((c) => (
                <div key={c.k} className="flex justify-between gap-3">
                  <span className="text-[#7A8FA8]">{c.label}</span>
                  <span className="text-[#F0ECE4] font-semibold text-right">
                    {atual && atual[c.k] !== confirmando[c.k] && <span className="line-through text-[#7A8FA8] mr-2 font-normal">{brl(atual[c.k])}</span>}
                    {brl(confirmando[c.k])}
                  </span>
                </div>
              ))}
              <p className="text-[#F0ECE4]"><span className="text-[#7A8FA8]">Próxima etapa:</span> {proximaEtapaTexto(confirmando.proxima_etapa).join("; ")}</p>
            </div>
            {avisosPreAprovacao(confirmando).map((a) => <p key={a} className="text-xs text-[#E8C97A]">{a}</p>)}
            {erro && <p className="text-xs text-red-400">{erro}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setConfirmando(null); setErro(null); }} disabled={enviando} className="h-9 px-4 rounded-lg border border-[#243A66] text-sm text-[#7A8FA8]">Voltar</button>
              <button onClick={enviar} disabled={enviando} className="h-9 px-4 rounded-lg bg-red-600 text-[#F0ECE4] text-sm font-bold flex items-center gap-2">
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
