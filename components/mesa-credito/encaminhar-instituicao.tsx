"use client";

// "Encaminhar para Instituição" no modal da proposta (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
// Três passos: instituições, destinatários (confirmar ou editar) e documentos/mensagem; confirmação
// em modal vermelho; histórico com a situação de cada e-mail (webhook do Resend).
import React, { useCallback, useMemo, useState } from "react";
import { Building2, Loader2, Mail, Send } from "lucide-react";
import { BotaoV3, ModalV3, dataBR } from "@/components/integracao-api/modal-v3";
import { dividirEmPartes, emailValido, type Situacao } from "@/lib/encaminhar-instituicao";

type ContatoT = { id: string; nome: string | null; email: string; uf: string | null; cargo: string; principal: boolean };
type InstT = { id: string; nome: string; contatos: ContatoT[]; contatos_padrao: string[]; ja_encaminhada_em: string | null };
type DocT = { doc_id: string; nome_documento: string; file_name: string; storage_path: string; bytes: number };
type DestT = { id: string; email: string; nome: string | null; fora_do_cadastro: boolean; parte: number; status: Situacao; motivo: string | null; enviado_em: string | null; entregue_em: string | null; aberto_em: string | null; devolvido_em: string | null; atualizado_em: string };
type EnvioT = { id: string; instituicao_nome: string; partes: number; documentos: unknown[]; enviado_por_nome: string | null; enviado_em: string; status: string; destinatarios_situacao: DestT[] };
type Dados = { uf_proposta: string | null; instituicoes: InstT[]; documentos: DocT[]; envios: EnvioT[] };
type Dest = { chave: string; email: string; nome: string | null; marcado: boolean; doCadastro: boolean };

export const ROTULO_SITUACAO: Record<Situacao, { t: string; cls: string }> = {
  enviado: { t: "Enviado", cls: "border-[#7A8FA8]/50 text-[#9AABC0]" },
  entregue: { t: "Entregue", cls: "border-[#C9A84C]/50 text-[#E8C97A]" },
  aberto: { t: "Aberto", cls: "border-emerald-500/40 text-emerald-300" },
  atrasado: { t: "Atrasado", cls: "border-amber-500/40 text-amber-300" },
  devolvido: { t: "Devolvido", cls: "border-red-500/50 text-red-300" },
  spam: { t: "Spam", cls: "border-red-500/50 text-red-300" },
  falha: { t: "Falhou", cls: "border-red-500/50 text-red-300" },
};

const mb = (b: number) => `${(b / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })} MB`;
const LIMITE = 20 * 1024 * 1024;
const MAX_ARQ = 25 * 1024 * 1024;

export function EncaminharInstituicao({ proposalId, onEncaminhado }: { proposalId: string; onEncaminhado?: (nomes: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selInst, setSelInst] = useState<string[]>([]);
  const [dest, setDest] = useState<Record<string, Dest[]>>({});
  const [avulso, setAvulso] = useState<Record<string, string>>({});
  const [docsSel, setDocsSel] = useState<string[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ nome: string; status: string; enviados: number; falhas: { email: string; parte: number; motivo: string }[] }[] | null>(null);
  const [previa, setPrevia] = useState<{ assunto: string; html: string } | null>(null);
  const [reenvio, setReenvio] = useState<{ d: DestT; email: string } | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await fetch(`/api/credit-proposals/${proposalId}/encaminhar`, { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok || !j) { setErro(j?.error ?? "Não foi possível carregar. A migration de contatos já foi aplicada?"); return; }
    setDados(j);
    setDocsSel((j as Dados).documentos.filter((d) => d.bytes <= MAX_ARQ).map((d) => d.storage_path));
  }, [proposalId]);

  function abrir() { setAberto(true); setResultado(null); void carregar(); }

  function alternarInst(i: InstT) {
    setSelInst((v) => v.includes(i.id) ? v.filter((x) => x !== i.id) : [...v, i.id]);
    setDest((d) => d[i.id] ? d : { ...d, [i.id]: i.contatos.map((c) => ({ chave: c.id, email: c.email, nome: c.nome, marcado: i.contatos_padrao.includes(c.id), doCadastro: true })) });
  }

  function editarDest(instId: string, chave: string, campo: Partial<Dest>) {
    setDest((d) => ({ ...d, [instId]: d[instId].map((x) => x.chave === chave ? { ...x, ...campo, doCadastro: campo.email !== undefined ? false : x.doCadastro } : x) }));
  }

  function incluirAvulso(instId: string) {
    const e = (avulso[instId] ?? "").trim().toLowerCase();
    if (!emailValido(e)) return;
    setDest((d) => ({ ...d, [instId]: [...(d[instId] ?? []), { chave: `avulso-${Date.now()}`, email: e, nome: null, marcado: true, doCadastro: false }] }));
    setAvulso((a) => ({ ...a, [instId]: "" }));
  }

  const instsSel = useMemo(() => (dados?.instituicoes ?? []).filter((i) => selInst.includes(i.id)), [dados, selInst]);
  const docsEscolhidos = useMemo(() => (dados?.documentos ?? []).filter((d) => docsSel.includes(d.storage_path)), [dados, docsSel]);
  const totalBytes = docsEscolhidos.reduce((s, d) => s + d.bytes, 0);
  const partes = Math.max(1, dividirEmPartes(docsEscolhidos, LIMITE, MAX_ARQ).partes.length);
  const destValidos = (id: string) => (dest[id] ?? []).filter((d) => d.marcado && emailValido(d.email));
  const podeEnviar = instsSel.length > 0 && instsSel.every((i) => destValidos(i.id).length > 0) && !enviando;
  const totalEmails = instsSel.reduce((s, i) => s + destValidos(i.id).length * partes, 0);

  async function verPrevia() {
    const r = await fetch(`/api/credit-proposals/${proposalId}/encaminhar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "previa", documentos: docsSel, mensagem }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (r?.ok && j) setPrevia(j); else setErro(j?.error ?? "Não foi possível montar a prévia.");
  }

  async function enviar() {
    setEnviando(true); setErro(null);
    const corpo = {
      acao: "enviar", documentos: docsSel, mensagem,
      instituicoes: instsSel.map((i) => ({ instituicao_id: i.id, destinatarios: destValidos(i.id).map((d) => ({ email: d.email.trim().toLowerCase(), nome: d.nome })) })),
    };
    const r = await fetch(`/api/credit-proposals/${proposalId}/encaminhar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    setEnviando(false); setConfirmar(false);
    if (!r?.ok || !j) { setErro(j?.error ?? "O envio não foi concluído."); return; }
    setResultado(j.resultados);
    onEncaminhado?.((j.resultados as { nome: string; status: string }[]).filter((x) => x.status !== "falha").map((x) => x.nome));
    setSelInst([]); setDest({}); setMensagem("");
    void carregar();
  }

  async function confirmarReenvio() {
    if (!reenvio) return;
    const r = await fetch(`/api/credit-proposals/${proposalId}/encaminhar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "reenviar", destinatario_id: reenvio.d.id, email: reenvio.email }) }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r?.ok) { setErro(j?.error ?? "O reenvio falhou."); }
    setReenvio(null);
    void carregar();
  }

  const campo = "w-full h-8 px-2.5 text-xs bg-[#111F35] border border-[#162744] rounded-lg text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]";

  return (
    <div className="p-4 rounded-xl border border-[#243A66] bg-[#09081A]/50 space-y-3">
      <p className="text-xs font-semibold text-[#9BAFC5] uppercase tracking-wider flex items-center gap-1.5">
        <Send className="w-3.5 h-3.5 text-[#C9A84C]" /> Encaminhar para Instituição
      </p>
      {!aberto ? (
        <button onClick={abrir} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C]/10 hover:bg-[#C9A84C]/20 border border-[#C9A84C]/25 text-[#C9A84C] text-xs font-semibold transition-colors">
          <Mail className="w-3 h-3" /> Encaminhar por e-mail
        </button>
      ) : !dados ? (
        erro ? <p className="text-xs text-red-300">{erro}</p> : <p className="text-xs text-[#9BAFC5] flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...</p>
      ) : (
        <div className="space-y-4 text-xs">
          {/* Passo 1 */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C9A84C]">1. Instituições</p>
            {dados.instituicoes.length === 0 ? <p className="text-[#7A8FA8]">Nenhuma instituição ativa no cadastro.</p> : (
              <div className="grid sm:grid-cols-2 gap-1.5 max-h-56 overflow-y-auto pr-1">
                {dados.instituicoes.map((i) => {
                  const sem = i.contatos.length === 0;
                  return (
                    <label key={i.id} htmlFor={`inst-${i.id}`} className={`flex items-start gap-2 p-2 rounded-lg border ${selInst.includes(i.id) ? "border-[#C9A84C]/50 bg-[#C9A84C]/5" : "border-[#162744]"} ${sem ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
                      <input id={`inst-${i.id}`} type="checkbox" disabled={sem} checked={selInst.includes(i.id)} onChange={() => alternarInst(i)} className="mt-0.5 accent-[#C9A84C]" />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1 text-[#F0ECE4] font-semibold"><Building2 className="w-3 h-3 flex-shrink-0" />{i.nome}</span>
                        {sem ? <span className="text-[10px] text-[#7A8FA8]">Sem e-mail cadastrado. Cadastre em Mesa Operacional, Instituições.</span>
                          : <span className="text-[10px] text-[#7A8FA8]">{i.contatos.length} contato{i.contatos.length > 1 ? "s" : ""}</span>}
                        {i.ja_encaminhada_em && <span className="block text-[10px] text-[#E8C97A]">Já encaminhada em {dataBR(i.ja_encaminhada_em)}</span>}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Passo 2 */}
          {instsSel.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C9A84C]">2. Destinatários{dados.uf_proposta ? ` (UF da proposta: ${dados.uf_proposta})` : ""}</p>
              {instsSel.map((i) => (
                <div key={i.id} className="p-2.5 rounded-lg border border-[#162744] space-y-1.5">
                  <p className="text-[#F0ECE4] font-semibold">{i.nome}</p>
                  {(dest[i.id] ?? []).map((d) => {
                    const c = i.contatos.find((x) => x.id === d.chave);
                    return (
                      <div key={d.chave} className="flex items-center gap-2">
                        <input type="checkbox" aria-label={`Enviar para ${d.email}`} checked={d.marcado} onChange={(e) => editarDest(i.id, d.chave, { marcado: e.target.checked })} className="accent-[#C9A84C]" />
                        <input aria-label="E-mail" value={d.email} onChange={(e) => editarDest(i.id, d.chave, { email: e.target.value })} className={`${campo} ${!emailValido(d.email) ? "border-red-500/60" : ""}`} />
                        <span className="text-[10px] text-[#7A8FA8] whitespace-nowrap">{c ? `${c.uf ?? "Nacional"} · ${c.nome ?? c.cargo}` : "fora do cadastro"}</span>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-2 pt-1">
                    <input aria-label="Incluir outro e-mail" placeholder="Incluir outro e-mail só neste envio" value={avulso[i.id] ?? ""} onChange={(e) => setAvulso((a) => ({ ...a, [i.id]: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); incluirAvulso(i.id); } }} className={campo} />
                    <BotaoV3 disabled={!emailValido(avulso[i.id] ?? "")} onClick={() => incluirAvulso(i.id)}>Incluir</BotaoV3>
                  </div>
                  {destValidos(i.id).length === 0 && <p className="text-[10px] text-red-300">Marque pelo menos um e-mail válido.</p>}
                </div>
              ))}
            </div>
          )}

          {/* Passo 3 */}
          {instsSel.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C9A84C]">3. Documentos e mensagem</p>
              {dados.documentos.length === 0 ? <p className="text-[#7A8FA8]">Esta proposta não tem documentos anexados.</p> : (
                <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                  {dados.documentos.map((d) => {
                    const grande = d.bytes > MAX_ARQ;
                    return (
                      <label key={d.storage_path} htmlFor={`doc-${d.storage_path}`} className={`flex items-center gap-2 ${grande ? "opacity-50" : "cursor-pointer"}`}>
                        <input id={`doc-${d.storage_path}`} type="checkbox" disabled={grande} checked={docsSel.includes(d.storage_path)} className="accent-[#C9A84C]"
                          onChange={(e) => setDocsSel((v) => e.target.checked ? [...v, d.storage_path] : v.filter((x) => x !== d.storage_path))} />
                        <span className="text-[#F0ECE4] truncate">{d.nome_documento}</span>
                        <span className="text-[#7A8FA8] truncate">{d.file_name}</span>
                        <span className="ml-auto tabular-nums text-[#7A8FA8] whitespace-nowrap">{grande ? "grande demais para e-mail" : mb(d.bytes)}</span>
                      </label>
                    );
                  })}
                </div>
              )}
              <p className="text-[#9AABC0]">{docsEscolhidos.length} documento{docsEscolhidos.length === 1 ? "" : "s"}, {mb(totalBytes)}.{partes > 1 ? ` O envio será dividido em ${partes} e-mails por destinatário.` : ""}</p>
              <label htmlFor="enc-msg" className="block text-[11px] text-[#F0ECE4] font-semibold">Mensagem para a instituição (opcional)</label>
              <textarea id="enc-msg" value={mensagem} onChange={(e) => setMensagem(e.target.value.slice(0, 2000))} rows={3} className="w-full px-2.5 py-2 text-xs bg-[#111F35] border border-[#162744] rounded-lg text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]" />
              <div className="flex flex-wrap gap-2">
                <BotaoV3 onClick={verPrevia}>Ver o e-mail</BotaoV3>
                <BotaoV3 tipo="primario" disabled={!podeEnviar} onClick={() => setConfirmar(true)}>Encaminhar</BotaoV3>
                <BotaoV3 onClick={() => { setAberto(false); setSelInst([]); setDest({}); }}>Fechar</BotaoV3>
              </div>
            </div>
          )}

          {erro && <p className="text-red-300">{erro}</p>}

          {resultado && (
            <div className="space-y-1">
              {resultado.map((r) => (
                <p key={r.nome} className={r.status === "enviado" ? "text-emerald-300" : "text-red-300"}>
                  {r.nome}: {r.status === "enviado" ? `enviado (${r.enviados} e-mail${r.enviados > 1 ? "s" : ""})` : r.status === "parcial" ? `parcial, ${r.falhas.length} falharam` : "falhou"}
                  {r.falhas.length > 0 && ` · ${r.falhas.map((f) => `${f.email}: ${f.motivo}`).join("; ")}`}
                </p>
              ))}
            </div>
          )}

          {/* Histórico */}
          <div className="space-y-2 pt-1 border-t border-[#162744]">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C9A84C] pt-2">Envios</p>
            {dados.envios.length === 0 ? <p className="text-[#7A8FA8]">Esta proposta ainda não foi encaminhada a nenhuma instituição.</p> : dados.envios.map((e) => (
              <div key={e.id} className="p-2.5 rounded-lg border border-[#162744] space-y-1">
                <p className="text-[#F0ECE4]"><b>{e.instituicao_nome}</b> · {dataBR(e.enviado_em, true)} · {e.documentos.length} documento{e.documentos.length === 1 ? "" : "s"}{e.partes > 1 ? `, ${e.partes} partes` : ""} · por {e.enviado_por_nome ?? "-"}</p>
                {e.destinatarios_situacao.map((d) => {
                  const s = ROTULO_SITUACAO[d.status] ?? ROTULO_SITUACAO.enviado;
                  const problema = d.status === "devolvido" || d.status === "spam" || d.status === "falha";
                  return (
                    <div key={d.id} className="flex flex-wrap items-center gap-2">
                      <span className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.cls}`}>{s.t}</span>
                      <span className="text-[#F0ECE4]">{d.email}</span>
                      {e.partes > 1 && <span className="text-[#7A8FA8]">parte {d.parte}</span>}
                      <span className="text-[#7A8FA8] tabular-nums">{dataBR(d.atualizado_em, true)}</span>
                      {d.motivo && <span className="text-red-300">{d.motivo}</span>}
                      {problema && <BotaoV3 onClick={() => setReenvio({ d, email: d.email })}>Corrigir e-mail e reenviar</BotaoV3>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      <ModalV3 aberto={confirmar} perigo titulo={`Encaminhar a proposta para ${instsSel.length} ${instsSel.length > 1 ? "instituições" : "instituição"}?`}
        rodape={<><BotaoV3 onClick={() => setConfirmar(false)} disabled={enviando}>Cancelar</BotaoV3><BotaoV3 tipo="perigo" disabled={enviando} onClick={enviar}>{enviando ? "Enviando..." : "Confirmar e enviar"}</BotaoV3></>}>
        <p>Serão enviados <b className="text-[#F0ECE4]">{totalEmails} e-mail{totalEmails > 1 ? "s" : ""}</b>, com {docsEscolhidos.length} documento{docsEscolhidos.length === 1 ? "" : "s"} ({mb(totalBytes)}){partes > 1 ? `, divididos em ${partes} partes` : ""}. Depois de enviado, o e-mail não pode ser desfeito.</p>
        {instsSel.map((i) => (
          <div key={i.id}>
            <p className="text-[#F0ECE4] font-semibold">{i.nome}</p>
            <ul className="pl-4 list-disc">
              {destValidos(i.id).map((d) => <li key={d.chave} className={d.doCadastro ? "" : "text-[#E8C97A] font-semibold"}>{d.email}{d.doCadastro ? "" : " (fora do cadastro, confira)"}</li>)}
            </ul>
          </div>
        ))}
      </ModalV3>

      <ModalV3 aberto={!!reenvio} perigo titulo="Corrigir e-mail e reenviar"
        rodape={<><BotaoV3 onClick={() => setReenvio(null)}>Cancelar</BotaoV3><BotaoV3 tipo="perigo" disabled={!reenvio || !emailValido(reenvio.email)} onClick={confirmarReenvio}>Reenviar</BotaoV3></>}>
        <p>O e-mail desta parte, com os mesmos documentos, será enviado de novo para o endereço abaixo.</p>
        <label htmlFor="reenvio-email" className="block text-[11px] font-semibold text-[#F0ECE4]">E-mail</label>
        <input id="reenvio-email" value={reenvio?.email ?? ""} onChange={(e) => setReenvio((r) => r ? { ...r, email: e.target.value } : r)} className={campo} />
      </ModalV3>

      <ModalV3 aberto={!!previa} titulo={previa?.assunto ?? "Prévia"} rodape={<BotaoV3 onClick={() => setPrevia(null)}>Fechar</BotaoV3>}>
        {previa && <iframe title="Prévia do e-mail" srcDoc={previa.html} sandbox="" className="w-full h-[60vh] rounded-lg border border-[#162744] bg-[#09081A]" />}
      </ModalV3>
    </div>
  );
}
