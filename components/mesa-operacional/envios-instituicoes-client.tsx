"use client";

// Tela "E-mails enviados" (Mesa Operacional): encaminhamentos de propostas às instituições, com a
// situação de cada e-mail (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Mail, X } from "lucide-react";
import { BotaoV3, ModalV3, dataBR } from "@/components/integracao-api/modal-v3";
import { ROTULO_SITUACAO } from "@/components/mesa-credito/encaminhar-instituicao";
import { emailValido, ORDEM_GRAVIDADE, type Situacao } from "@/lib/encaminhar-instituicao";

type Dest = { id: string; email: string; nome: string | null; fora_do_cadastro: boolean; parte: number; status: Situacao; motivo: string | null; enviado_em: string | null; entregue_em: string | null; aberto_em: string | null; devolvido_em: string | null; substituido_por: string | null; atualizado_em: string };
type Envio = {
  id: string; proposal_id: string; proposta_code: string; cliente: string; instituicao_nome: string; destinatarios: string[];
  assunto: string; mensagem: string | null; documentos: { nome_documento: string; file_name: string; bytes: number }[];
  partes: number; enviado_por_nome: string | null; enviado_em: string; situacao_geral: Situacao | null;
  credit_proposal_envio_destinatarios: Dest[];
};
type Resp = {
  periodo: { de: string; ate: string }; resumo: { envios: number; entregues: number; abertos: number; devolvidos: number; falhas: number };
  envios: Envio[]; total: number; pagina: number; por_pagina: number;
  instituicoes: { id: string; nome: string }[]; remetentes: { id: string; nome: string }[];
};

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
const campo = "h-9 px-3 text-xs bg-[#111F35] border border-[#162744] rounded-lg text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]";

function Etiqueta({ s }: { s: Situacao | null }) {
  if (!s) return <span className="text-[#7A8FA8]">-</span>;
  const r = ROTULO_SITUACAO[s];
  return <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${r.cls}`}>{r.t}</span>;
}

export function EnviosInstituicoesClient() {
  const [f, setF] = useState({ de: "", ate: "", instituicao_id: "", situacao: "", enviado_por: "", busca: "", pagina: 1 });
  const [dados, setDados] = useState<Resp | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [detalhe, setDetalhe] = useState<Envio | null>(null);
  const [reenvio, setReenvio] = useState<{ d: Dest; envio: Envio; email: string } | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true); setErro(null);
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) q.set(k, String(v));
    const r = await fetch(`/api/envios-instituicoes?${q.toString()}`, { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setCarregando(false);
    if (!r?.ok || !j) { setErro(j?.error ?? "Não foi possível carregar."); return; }
    setDados(j);
    if (!f.de) setF((x) => ({ ...x, de: j.periodo.de, ate: j.periodo.ate }));
  }, [f]);
  useEffect(() => { void carregar(); }, [carregar]);

  const mudar = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v, pagina: 1 }));

  async function confirmarReenvio() {
    if (!reenvio) return;
    const r = await fetch(`/api/credit-proposals/${reenvio.envio.proposal_id}/encaminhar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reenviar", destinatario_id: reenvio.d.id, email: reenvio.email }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok) setErro(j?.error ?? "O reenvio falhou.");
    setReenvio(null); setDetalhe(null);
    void carregar();
  }

  const resumo = dados?.resumo;
  const totalPaginas = dados ? Math.max(1, Math.ceil(dados.total / dados.por_pagina)) : 1;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-1">
        <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[#C9A84C]">Mesa Operacional</p>
        <h1 className="text-3xl font-bold text-[#F0ECE4]">E-mails enviados</h1>
        <p className="text-sm text-[#7A8FA8]">Propostas encaminhadas às instituições e a situação de cada e-mail.</p>
      </header>

      {resumo && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {([["Envios no período", resumo.envios, ""], ["Entregues", resumo.entregues, "entregue"], ["Abertos", resumo.abertos, "aberto"], ["Devolvidos ou spam", resumo.devolvidos, "devolvido"], ["Com falha", resumo.falhas, "falha"]] as const).map(([t, n, s]) => (
            <button key={t} onClick={() => mudar("situacao", s)} className={`text-left rounded-xl border p-4 transition ${f.situacao === s && s ? "border-[#C9A84C] bg-[#C9A84C]/10" : "border-[#162744] bg-[#111F35] hover:border-[#243A66]"}`}>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#C9A84C]">{t}</p>
              <p className={`text-2xl font-bold tabular-nums ${(s === "devolvido" || s === "falha") && n > 0 ? "text-red-300" : "text-[#F0ECE4]"}`}>{n}</p>
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-[10px] text-[#7A8FA8]" htmlFor="f-de">De<br /><input id="f-de" type="date" value={f.de} onChange={(e) => mudar("de", e.target.value)} className={campo} /></label>
        <label className="text-[10px] text-[#7A8FA8]" htmlFor="f-ate">Até<br /><input id="f-ate" type="date" value={f.ate} onChange={(e) => mudar("ate", e.target.value)} className={campo} /></label>
        <label className="text-[10px] text-[#7A8FA8]" htmlFor="f-inst">Instituição<br />
          <select id="f-inst" value={f.instituicao_id} onChange={(e) => mudar("instituicao_id", e.target.value)} className={campo}>
            <option value="">Todas</option>{dados?.instituicoes.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
          </select></label>
        <label className="text-[10px] text-[#7A8FA8]" htmlFor="f-sit">Situação<br />
          <select id="f-sit" value={f.situacao} onChange={(e) => mudar("situacao", e.target.value)} className={campo}>
            <option value="">Todas</option>{ORDEM_GRAVIDADE.map((s) => <option key={s} value={s}>{ROTULO_SITUACAO[s].t}</option>)}
          </select></label>
        <label className="text-[10px] text-[#7A8FA8]" htmlFor="f-por">Quem enviou<br />
          <select id="f-por" value={f.enviado_por} onChange={(e) => mudar("enviado_por", e.target.value)} className={campo}>
            <option value="">Todos</option>{dados?.remetentes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
          </select></label>
        <label className="text-[10px] text-[#7A8FA8] flex-1 min-w-[200px]" htmlFor="f-busca">Busca<br />
          <input id="f-busca" value={f.busca} onChange={(e) => mudar("busca", e.target.value)} placeholder="Código da proposta, cliente ou e-mail" className={`${campo} w-full`} /></label>
      </div>

      {erro && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{erro}</div>}
      {!dados && carregando && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-[#C9A84C]" /></div>}

      {dados && (dados.envios.length === 0 ? (
        <div className="rounded-xl border border-[#162744] bg-[#111F35] p-10 text-center text-sm text-[#7A8FA8]">Nenhum e-mail enviado no período. Os encaminhamentos feitos pelo modal da proposta aparecem aqui.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#162744]">
          <table className="w-full min-w-[1000px] text-[13px]">
            <thead className="bg-[#111F35]"><tr className="text-left text-[9px] font-bold tracking-[0.12em] uppercase text-[#C9A84C]">
              <th className="px-3 py-3">Data e hora</th><th className="px-3 py-3">Proposta</th><th className="px-3 py-3">Instituição</th><th className="px-3 py-3">Destinatários</th>
              <th className="px-3 py-3">Documentos</th><th className="px-3 py-3">Enviado por</th><th className="px-3 py-3">Situação</th>
            </tr></thead>
            <tbody>
              {dados.envios.map((e) => (
                <tr key={e.id} onClick={() => setDetalhe(e)} className="border-t border-[#162744] text-[#9AABC0] hover:bg-[#111F35] cursor-pointer align-top">
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">{dataBR(e.enviado_em, true)}</td>
                  <td className="px-3 py-3"><div className="text-[#F0ECE4] font-mono text-xs">{e.proposta_code}</div><div className="text-[11px]">{e.cliente}</div></td>
                  <td className="px-3 py-3 text-[#F0ECE4]">{e.instituicao_nome}</td>
                  <td className="px-3 py-3 text-[11px]">{e.destinatarios.slice(0, 3).join(", ")}{e.destinatarios.length > 3 ? ` +${e.destinatarios.length - 3}` : ""}</td>
                  <td className="px-3 py-3 tabular-nums whitespace-nowrap">{e.documentos.length} · {mb(e.documentos.reduce((s, d) => s + (d.bytes || 0), 0))}{e.partes > 1 ? ` · ${e.partes} partes` : ""}</td>
                  <td className="px-3 py-3">{e.enviado_por_nome ?? "-"}</td>
                  <td className="px-3 py-3"><Etiqueta s={e.situacao_geral} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {dados && totalPaginas > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-[#7A8FA8]">
          <BotaoV3 disabled={f.pagina <= 1} onClick={() => setF((x) => ({ ...x, pagina: x.pagina - 1 }))}>Anterior</BotaoV3>
          <span className="tabular-nums">Página {f.pagina} de {totalPaginas}</span>
          <BotaoV3 disabled={f.pagina >= totalPaginas} onClick={() => setF((x) => ({ ...x, pagina: x.pagina + 1 }))}>Próxima</BotaoV3>
        </div>
      )}

      {detalhe && (
        <div className="fixed inset-0 z-[120] flex justify-end bg-black/50" role="dialog" aria-modal="true" aria-label="Detalhe do envio">
          <div className="w-full max-w-xl h-full overflow-y-auto bg-[#09081A] border-l border-[#C9A84C]/30 p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#C9A84C]">{dataBR(detalhe.enviado_em, true)} · por {detalhe.enviado_por_nome ?? "-"}</p>
                <h2 className="text-lg font-semibold text-[#F0ECE4]">{detalhe.instituicao_nome}</h2>
                <p className="text-xs text-[#7A8FA8]">{detalhe.assunto}</p>
              </div>
              <button onClick={() => setDetalhe(null)} aria-label="Fechar" className="text-[#7A8FA8] hover:text-[#F0ECE4]"><X className="w-5 h-5" /></button>
            </div>
            <Link href={`/mesa-operacional?proposalId=${detalhe.proposal_id}`} className="inline-flex text-xs font-semibold text-[#E8C97A] hover:underline">Abrir proposta {detalhe.proposta_code}</Link>
            {detalhe.mensagem && <div className="rounded-lg border border-[#162744] bg-[#111F35] p-3 text-xs text-[#F0ECE4] whitespace-pre-wrap">{detalhe.mensagem}</div>}
            <div>
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#C9A84C] mb-1">Documentos{detalhe.partes > 1 ? ` (${detalhe.partes} partes)` : ""}</p>
              <ul className="text-xs text-[#9AABC0] space-y-0.5">{detalhe.documentos.map((d, i) => <li key={i}>{d.nome_documento} <span className="text-[#7A8FA8]">({d.file_name}, {mb(d.bytes || 0)})</span></li>)}</ul>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[#C9A84C]">Destinatários</p>
              {[...detalhe.credit_proposal_envio_destinatarios].sort((a, b) => a.email.localeCompare(b.email, "pt-BR") || a.parte - b.parte || a.atualizado_em.localeCompare(b.atualizado_em)).map((d) => {
                const problema = !d.substituido_por && (d.status === "devolvido" || d.status === "spam" || d.status === "falha");
                return (
                  <div key={d.id} className={`rounded-lg border p-3 text-xs space-y-1 ${d.substituido_por ? "border-[#162744] opacity-60" : "border-[#162744]"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Mail className="w-3 h-3 text-[#7A8FA8]" /><span className="text-[#F0ECE4]">{d.email}</span>
                      {detalhe.partes > 1 && <span className="text-[#7A8FA8]">parte {d.parte}</span>}
                      {d.fora_do_cadastro && <span className="text-[#E8C97A]">fora do cadastro</span>}
                      <Etiqueta s={d.status} />{d.substituido_por && <span className="text-[#7A8FA8]">substituído por reenvio</span>}
                    </div>
                    <ul className="text-[#7A8FA8] tabular-nums pl-5 list-disc">
                      {d.enviado_em && <li>Enviado em {dataBR(d.enviado_em, true)}</li>}
                      {d.entregue_em && <li>Entregue em {dataBR(d.entregue_em, true)}</li>}
                      {d.aberto_em && <li>Aberto em {dataBR(d.aberto_em, true)}</li>}
                      {d.devolvido_em && <li className="text-red-300">{d.status === "spam" ? "Marcado como spam" : "Devolvido"} em {dataBR(d.devolvido_em, true)}{d.motivo ? `: ${d.motivo}` : ""}</li>}
                      {d.status === "falha" && <li className="text-red-300">Não saiu: {d.motivo ?? "falha no envio"}</li>}
                    </ul>
                    {problema && <BotaoV3 onClick={() => setReenvio({ d, envio: detalhe, email: d.email })}>Corrigir e-mail e reenviar</BotaoV3>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <ModalV3 aberto={!!reenvio} perigo titulo="Corrigir e-mail e reenviar"
        rodape={<><BotaoV3 onClick={() => setReenvio(null)}>Cancelar</BotaoV3><BotaoV3 tipo="perigo" disabled={!reenvio || !emailValido(reenvio.email)} onClick={confirmarReenvio}>Reenviar</BotaoV3></>}>
        <p>O e-mail desta parte, com os mesmos documentos, será enviado de novo para o endereço abaixo.</p>
        <label htmlFor="env-reenvio-email" className="block text-[11px] font-semibold text-[#F0ECE4]">E-mail</label>
        <input id="env-reenvio-email" value={reenvio?.email ?? ""} onChange={(e) => setReenvio((r) => r ? { ...r, email: e.target.value } : r)} className={`${campo} w-full`} />
      </ModalV3>
    </div>
  );
}
