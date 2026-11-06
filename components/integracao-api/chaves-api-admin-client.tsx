"use client";

// ADMIN: chaves de API de todos os partners, revogação com motivo, limites, incidentes e termo.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { BotaoV3, ModalV3, dataBR } from "@/components/integracao-api/modal-v3";

type Chave = {
  id: string; partner_id: string; partner_nome: string; plano: string | null; nome: string; prefixo: string;
  escopos: string[]; ips_permitidos: string[]; expira_em: string; limite_por_minuto: number; limite_propostas_dia: number;
  ultimo_uso_em: string | null; ultimo_ip: string | null; revogada_em: string | null; motivo_revogacao: string | null;
  created_at: string; situacao: "ativa" | "vencida" | "revogada";
};
type Incidente = { id: string; ocorrido_em: string; partner_nome: string | null; descricao: string; medidas: string | null; corrige_id: string | null; registrado_por_nome: string | null };
type Termo = { versao: string; hash: string; vigencia_inicio: string };

const PLANOS_COM_API = ["PARTNER_PRO", "GOLD", "DIAMANTE", "ENTERPRISE"];
const campo = "w-full rounded-lg bg-[#111F35] border border-[#162744] px-3 py-2 text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]";

export function ChavesApiAdminClient() {
  const [dados, setDados] = useState<{ chaves: Chave[]; termos: Termo[]; incidentes: Incidente[] } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtroSit, setFiltroSit] = useState("todas");
  const [filtroPartner, setFiltroPartner] = useState("");
  const [revogar, setRevogar] = useState<Chave | null>(null);
  const [limite, setLimite] = useState<Chave | null>(null);
  const [incidente, setIncidente] = useState(false);
  const [termo, setTermo] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await fetch("/api/admin/api-chaves", { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) { setErro(j?.error ?? "Não foi possível carregar."); return; }
    setDados(j);
  }, []);
  useEffect(() => { void carregar(); }, [carregar]);

  const lista = useMemo(() => (dados?.chaves ?? []).filter((k) => {
    const bloqueada = k.situacao === "ativa" && !PLANOS_COM_API.includes(k.plano ?? "");
    const sit = bloqueada ? "bloqueada" : k.situacao;
    return (filtroSit === "todas" || sit === filtroSit) && (!filtroPartner || k.partner_id === filtroPartner);
  }), [dados, filtroSit, filtroPartner]);
  const partners = useMemo(() => {
    const m = new Map<string, string>();
    for (const k of dados?.chaves ?? []) m.set(k.partner_id, k.partner_nome);
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [dados]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[#C9A84C]">Cadastros · API de Propostas</p>
          <h1 className="text-3xl font-bold text-[#F0ECE4]">Chaves de API</h1>
          <p className="text-sm text-[#7A8FA8]">Termo vigente: {dados?.termos?.[0] ? `versão ${dados.termos[0].versao}, desde ${dataBR(dados.termos[0].vigencia_inicio)}` : "nenhum publicado"}.</p>
        </div>
        <div className="flex gap-2">
          <BotaoV3 onClick={() => setTermo(true)}>Publicar termo</BotaoV3>
          <BotaoV3 onClick={() => setIncidente(true)}>Registrar incidente</BotaoV3>
        </div>
      </header>

      {erro && <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{erro}</div>}
      {!dados && !erro && <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#C9A84C]" /></div>}

      {dados && (<>
        <section className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <label className="text-[11px] text-[#7A8FA8]" htmlFor="f-sit">Situação
              <select id="f-sit" value={filtroSit} onChange={(e) => setFiltroSit(e.target.value)} className={`${campo} mt-1`}>
                <option value="todas">Todas</option><option value="ativa">Ativa</option><option value="vencida">Vencida</option>
                <option value="revogada">Revogada</option><option value="bloqueada">Bloqueada (plano sem API)</option>
              </select>
            </label>
            <label className="text-[11px] text-[#7A8FA8]" htmlFor="f-partner">Partner
              <select id="f-partner" value={filtroPartner} onChange={(e) => setFiltroPartner(e.target.value)} className={`${campo} mt-1`}>
                <option value="">Todos</option>
                {partners.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
          </div>
          {dados.chaves.length === 0 ? (
            <div className="rounded-xl border border-[#162744] bg-[#111F35] p-8 text-center text-sm text-[#7A8FA8]">Nenhum partner criou chave de API ainda.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[#162744]">
              <table className="w-full min-w-[980px] text-[13px]">
                <thead className="bg-[#111F35]"><tr className="text-left text-[9px] font-bold tracking-[0.12em] uppercase text-[#C9A84C]">
                  <th className="px-3 py-3">Partner</th><th className="px-3 py-3">Chave</th><th className="px-3 py-3">Plano</th><th className="px-3 py-3">IPs</th>
                  <th className="px-3 py-3">Criada em</th><th className="px-3 py-3">Vence em</th><th className="px-3 py-3">Último uso</th>
                  <th className="px-3 py-3">Limites</th><th className="px-3 py-3">Situação</th><th className="px-3 py-3" />
                </tr></thead>
                <tbody>
                  {lista.map((k) => {
                    const bloqueada = k.situacao === "ativa" && !PLANOS_COM_API.includes(k.plano ?? "");
                    return (
                      <tr key={k.id} className="border-t border-[#162744] align-top text-[#7A8FA8]">
                        <td className="px-3 py-3 text-[#F0ECE4]">{k.partner_nome}</td>
                        <td className="px-3 py-3"><div className="text-[#F0ECE4]">{k.nome}</div><div className="font-mono text-[11px]">{k.prefixo}…</div></td>
                        <td className="px-3 py-3">{k.plano ?? "-"}</td>
                        <td className="px-3 py-3 font-mono text-[11px]">{k.ips_permitidos.join(", ")}</td>
                        <td className="px-3 py-3 tabular-nums">{dataBR(k.created_at)}</td>
                        <td className="px-3 py-3 tabular-nums">{dataBR(k.expira_em)}</td>
                        <td className="px-3 py-3 tabular-nums">{k.ultimo_uso_em ? `${dataBR(k.ultimo_uso_em, true)} · ${k.ultimo_ip ?? ""}` : "Nunca"}</td>
                        <td className="px-3 py-3 tabular-nums">{k.limite_por_minuto}/min · {k.limite_propostas_dia}/dia</td>
                        <td className="px-3 py-3">{bloqueada ? "Bloqueada (plano)" : k.situacao === "ativa" ? "Ativa" : k.situacao === "vencida" ? "Vencida" : `Revogada: ${k.motivo_revogacao ?? ""}`}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap space-x-2">
                          {k.situacao === "ativa" && <><BotaoV3 onClick={() => setLimite(k)}>Ajustar limite</BotaoV3><BotaoV3 tipo="perigo" onClick={() => setRevogar(k)}>Revogar</BotaoV3></>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold text-[#F0ECE4]">Incidentes de segurança</h2>
          {dados.incidentes.length === 0 ? (
            <div className="rounded-xl border border-[#162744] bg-[#111F35] p-6 text-center text-sm text-[#7A8FA8]">Nenhum incidente registrado.</div>
          ) : (
            <ul className="space-y-2">
              {dados.incidentes.map((i) => (
                <li key={i.id} className="rounded-xl border border-[#162744] bg-[#111F35] p-4 text-[13px] text-[#7A8FA8] space-y-1">
                  <div className="text-[#F0ECE4] font-semibold tabular-nums">{dataBR(i.ocorrido_em, true)}{i.partner_nome ? ` · ${i.partner_nome}` : ""}{i.corrige_id ? " · correção de registro anterior" : ""}</div>
                  <p className="whitespace-pre-wrap">{i.descricao}</p>
                  {i.medidas && <p className="whitespace-pre-wrap"><b className="text-[#F0ECE4]">Medidas:</b> {i.medidas}</p>}
                  <p className="text-[11px]">Registrado por {i.registrado_por_nome ?? "-"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </>)}

      <RevogarAdmin chave={revogar} onFechar={(m) => { setRevogar(null); if (m) void carregar(); }} />
      <LimiteAdmin chave={limite} onFechar={(m) => { setLimite(null); if (m) void carregar(); }} />
      <IncidenteAdmin aberto={incidente} partners={partners} incidentes={dados?.incidentes ?? []} onFechar={(m) => { setIncidente(false); if (m) void carregar(); }} />
      <TermoAdmin aberto={termo} onFechar={(m) => { setTermo(false); if (m) void carregar(); }} />
    </div>
  );
}

async function enviar(url: string, method: string, body: unknown): Promise<string | null> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const j = r ? await r.json().catch(() => ({})) : {};
  return r?.ok ? null : (j.error ?? "Não foi possível concluir.");
}

function RevogarAdmin({ chave, onFechar }: { chave: Chave | null; onFechar: (mudou: boolean) => void }) {
  const [motivo, setMotivo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const fechar = (m: boolean) => { setMotivo(""); setErro(null); onFechar(m); };
  return (
    <ModalV3 aberto={!!chave} perigo titulo={`Revogar a chave ${chave?.nome ?? ""} de ${chave?.partner_nome ?? ""}?`}
      rodape={<><BotaoV3 onClick={() => fechar(false)}>Cancelar</BotaoV3>
        <BotaoV3 tipo="perigo" disabled={carregando || motivo.trim().length < 10} onClick={async () => {
          setCarregando(true); const e = await enviar(`/api/admin/api-chaves/${chave!.id}`, "POST", { acao: "revogar", motivo }); setCarregando(false);
          if (e) setErro(e); else fechar(true);
        }}>{carregando ? "Revogando..." : "Revogar chave"}</BotaoV3></>}>
      <p>As integrações desse partner que usam esta chave param na hora. O partner recebe um e-mail com o motivo.</p>
      <label htmlFor="rev-motivo" className="block text-[11px] font-semibold text-[#F0ECE4]">Motivo (mínimo 10 caracteres)</label>
      <textarea id="rev-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={500} className={campo} />
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </ModalV3>
  );
}

function LimiteAdmin({ chave, onFechar }: { chave: Chave | null; onFechar: (mudou: boolean) => void }) {
  const [min, setMin] = useState("");
  const [dia, setDia] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => { if (chave) { setMin(String(chave.limite_por_minuto)); setDia(String(chave.limite_propostas_dia)); setErro(null); } }, [chave]);
  return (
    <ModalV3 aberto={!!chave} titulo={`Ajustar limite: ${chave?.nome ?? ""}`}
      rodape={<><BotaoV3 onClick={() => onFechar(false)}>Cancelar</BotaoV3>
        <BotaoV3 tipo="primario" onClick={async () => {
          const e = await enviar(`/api/admin/api-chaves/${chave!.id}`, "PATCH", { limite_por_minuto: Number(min), limite_propostas_dia: Number(dia) });
          if (e) setErro(e); else onFechar(true);
        }}>Salvar</BotaoV3></>}>
      <label htmlFor="lim-min" className="block text-[11px] font-semibold text-[#F0ECE4]">Chamadas por minuto (1 a 600)</label>
      <input id="lim-min" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ""))} className={campo} />
      <label htmlFor="lim-dia" className="block text-[11px] font-semibold text-[#F0ECE4]">Propostas por dia (1 a 5.000)</label>
      <input id="lim-dia" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value.replace(/\D/g, ""))} className={campo} />
      <p className="text-[11px]">A alteração fica registrada na auditoria.</p>
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </ModalV3>
  );
}

function IncidenteAdmin({ aberto, partners, incidentes, onFechar }: { aberto: boolean; partners: [string, string][]; incidentes: Incidente[]; onFechar: (mudou: boolean) => void }) {
  const [quando, setQuando] = useState("");
  const [partner, setPartner] = useState("");
  const [descricao, setDescricao] = useState("");
  const [medidas, setMedidas] = useState("");
  const [corrige, setCorrige] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const fechar = (m: boolean) => { setQuando(""); setPartner(""); setDescricao(""); setMedidas(""); setCorrige(""); setErro(null); onFechar(m); };
  return (
    <ModalV3 aberto={aberto} titulo="Registrar incidente de segurança"
      rodape={<><BotaoV3 onClick={() => fechar(false)}>Cancelar</BotaoV3>
        <BotaoV3 tipo="primario" disabled={!quando || descricao.trim().length < 10} onClick={async () => {
          // datetime-local é hora de Brasília: anexa o fuso antes de enviar.
          const e = await enviar("/api/admin/api-incidentes", "POST", { ocorrido_em: `${quando}:00-03:00`, partner_id: partner || null, descricao, medidas: medidas || null, corrige_id: corrige || null });
          if (e) setErro(e); else fechar(true);
        }}>Registrar</BotaoV3></>}>
      <p>O registro fica guardado por 5 anos e não pode ser editado nem apagado. Para corrigir, registre outro apontando o anterior.</p>
      <label htmlFor="inc-quando" className="block text-[11px] font-semibold text-[#F0ECE4]">Data e hora do incidente (Brasília)</label>
      <input id="inc-quando" type="datetime-local" value={quando} onChange={(e) => setQuando(e.target.value)} className={campo} />
      <label htmlFor="inc-partner" className="block text-[11px] font-semibold text-[#F0ECE4]">Partner envolvido (opcional)</label>
      <select id="inc-partner" value={partner} onChange={(e) => setPartner(e.target.value)} className={campo}>
        <option value="">Nenhum</option>{partners.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
      </select>
      <label htmlFor="inc-desc" className="block text-[11px] font-semibold text-[#F0ECE4]">Descrição</label>
      <textarea id="inc-desc" value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className={campo} />
      <label htmlFor="inc-med" className="block text-[11px] font-semibold text-[#F0ECE4]">Medidas tomadas</label>
      <textarea id="inc-med" value={medidas} onChange={(e) => setMedidas(e.target.value)} rows={3} className={campo} />
      <label htmlFor="inc-corr" className="block text-[11px] font-semibold text-[#F0ECE4]">Corrige o registro (opcional)</label>
      <select id="inc-corr" value={corrige} onChange={(e) => setCorrige(e.target.value)} className={campo}>
        <option value="">Não é correção</option>{incidentes.map((i) => <option key={i.id} value={i.id}>{dataBR(i.ocorrido_em, true)} · {i.descricao.slice(0, 50)}</option>)}
      </select>
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </ModalV3>
  );
}

function TermoAdmin({ aberto, onFechar }: { aberto: boolean; onFechar: (mudou: boolean) => void }) {
  const [versao, setVersao] = useState("");
  const [vigencia, setVigencia] = useState("");
  const [texto, setTexto] = useState("");
  const [confirmo, setConfirmo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const fechar = (m: boolean) => { setVersao(""); setVigencia(""); setTexto(""); setConfirmo(false); setErro(null); onFechar(m); };
  return (
    <ModalV3 aberto={aberto} perigo titulo="Publicar versão do Termo de Uso da API"
      rodape={<><BotaoV3 onClick={() => fechar(false)}>Cancelar</BotaoV3>
        <BotaoV3 tipo="perigo" disabled={!versao || !vigencia || texto.length < 2000 || !confirmo} onClick={async () => {
          const e = await enviar("/api/admin/api-termos", "POST", { versao, vigencia_inicio: `${vigencia}T00:00:00-03:00`, texto });
          if (e) setErro(e); else fechar(true);
        }}>Publicar</BotaoV3></>}>
      <p>Ao entrar em vigor, as chaves de quem ainda não aceitou esta versão param até o novo aceite. A publicação não pode ser desfeita, e o texto com lacunas entre colchetes é recusado.</p>
      <label htmlFor="t-versao" className="block text-[11px] font-semibold text-[#F0ECE4]">Versão</label>
      <input id="t-versao" value={versao} onChange={(e) => setVersao(e.target.value)} placeholder="2.1" className={campo} />
      <label htmlFor="t-vig" className="block text-[11px] font-semibold text-[#F0ECE4]">Início da vigência</label>
      <input id="t-vig" type="date" value={vigencia} onChange={(e) => setVigencia(e.target.value)} className={campo} />
      <label htmlFor="t-texto" className="block text-[11px] font-semibold text-[#F0ECE4]">Texto integral, revisado pelo Robson</label>
      <textarea id="t-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={10} className={`${campo} font-mono text-[11px]`} />
      <label htmlFor="t-conf" className="flex gap-2 items-start cursor-pointer">
        <input id="t-conf" type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} className="mt-1 accent-[#C9A84C]" />
        <span className="text-[#F0ECE4]">Confirmo que este texto é a versão revisada pelo compliance.</span>
      </label>
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </ModalV3>
  );
}
