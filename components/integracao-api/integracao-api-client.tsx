"use client";

// Tela "Integração por API" do partner (BRIEF 2026-11-06): termo com aceite, chaves, revogação.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Download, KeyRound, Loader2, Link2, ShieldCheck } from "lucide-react";
import { BotaoV3, ModalV3, dataBR } from "@/components/integracao-api/modal-v3";

type Chave = {
  id: string; nome: string; prefixo: string; escopos: string[]; ips_permitidos: string[];
  expira_em: string; ultimo_uso_em: string | null; ultimo_ip: string | null;
  revogada_em: string | null; motivo_revogacao: string | null; created_at: string;
};
type Dados = {
  plano_ok: boolean; email?: string | null; ip_atual?: string | null; aceito?: boolean; chaves?: Chave[];
  termo?: { versao: string; texto: string; hash: string; vigencia_inicio: string; destaques: { clausula: string; texto: string }[] } | null;
};

const ROTULO_ESCOPO: Record<string, string> = { "propostas:criar": "Criar propostas e enviar documentos", "propostas:ler": "Consultar propostas" };

function situacao(k: Chave): { rotulo: string; cls: string } {
  if (k.revogada_em) return { rotulo: "Revogada", cls: "border-red-500/40 text-red-300" };
  if (new Date(k.expira_em).getTime() <= Date.now()) return { rotulo: "Vencida", cls: "border-[#7A8FA8]/50 text-[#7A8FA8]" };
  return { rotulo: "Ativa", cls: "border-[#C9A84C]/50 text-[#E8C97A]" };
}

function sessaoId(): string {
  try {
    const k = "v3_api_sessao";
    const v = sessionStorage.getItem(k);
    if (v) return v;
    const n = crypto.randomUUID();
    sessionStorage.setItem(k, n);
    return n;
  } catch { return "indisponivel"; }
}

export function IntegracaoApiClient({ planoOk }: { planoOk: boolean }) {
  const [dados, setDados] = useState<Dados | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await fetch("/api/integracao-api", { cache: "no-store" }).catch(() => null);
    const j = r ? await r.json().catch(() => null) : null;
    if (!r || !r.ok || !j) { setErro(j?.error ?? "Não foi possível carregar. Recarregue a página."); return; }
    setDados(j);
  }, []);
  useEffect(() => { if (planoOk) void carregar(); }, [planoOk, carregar]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="space-y-2">
        <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[#C9A84C]">Integração por API</p>
        <h1 className="text-3xl font-bold text-[#F0ECE4]">Conecte o sistema da sua empresa à V3</h1>
        <p className="text-sm text-[#7A8FA8] max-w-2xl">Com uma chave de API, o sistema da sua empresa cadastra propostas de crédito, envia documentos e acompanha o andamento direto na Mesa de Crédito da V3.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <a href="/API" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#E8C97A] hover:underline">
            <Link2 size={13} /> Documentação para o seu dev
          </a>
          {/* Guia em PDF, modelo premium V3 (adendo do BRIEF 2026-11-06_api-v1-ajustes-seguranca). */}
          <a href="/integracao/V3-Guia-API-Propostas.pdf" download="V3-Guia-API-Propostas.pdf" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 text-xs font-semibold text-[#E8C97A] hover:bg-[#C9A84C]/20 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#C9A84C]">
            <Download size={13} /> Baixar guia em PDF
          </a>
        </div>
      </header>

      {!planoOk ? (
        <div className="rounded-xl border border-[#162744] bg-[#111F35] p-6 text-sm text-[#7A8FA8]">
          A integração por API está disponível nos planos Partner PRO, Gold, Diamante e Enterprise. Fale com a V3 para mudar de plano.
        </div>
      ) : erro ? (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">{erro}</div>
      ) : !dados ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#C9A84C]" /></div>
      ) : !dados.termo ? (
        <div className="rounded-xl border border-[#162744] bg-[#111F35] p-6 text-sm text-[#7A8FA8]">A V3 ainda não publicou o Termo de Uso da API. Volte em breve.</div>
      ) : !dados.aceito ? (
        <AceiteTermo termo={dados.termo} onAceito={carregar} />
      ) : (
        <Chaves dados={dados} onMudou={carregar} />
      )}
    </div>
  );
}

function AceiteTermo({ termo, onAceito }: { termo: NonNullable<Dados["termo"]>; onAceito: () => void }) {
  const [geral, setGeral] = useState(false);
  const [destaques, setDestaques] = useState(false);
  const [poderes, setPoderes] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aceitar() {
    setEnviando(true); setErro(null);
    const r = await fetch("/api/integracao-api/termo", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        versao: termo.versao, hash: termo.hash, aceite_geral: geral, aceite_destaques: destaques, poderes_confirmados: poderes,
        dispositivo: `${navigator.platform || "desconhecido"} · ${window.screen.width}x${window.screen.height}`.slice(0, 200),
        sessao_id: sessaoId(),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setEnviando(false);
    if (!r?.ok) { setErro(j.error ?? "Não foi possível registrar o aceite."); return; }
    onAceito();
  }

  return (
    <section className="space-y-4">
      <div className="rounded-xl border border-[#C9A84C]/30 bg-[#111F35] p-5 space-y-1">
        <h2 className="text-lg font-semibold text-[#F0ECE4]">Termo de Uso da API, versão {termo.versao}</h2>
        <p className="text-xs text-[#7A8FA8]">Antes de criar a primeira chave, leia e aceite o termo. Em vigor desde {dataBR(termo.vigencia_inicio)}.</p>
      </div>

      <div className="rounded-xl border border-red-500/40 bg-red-500/5 p-5 space-y-3">
        <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-red-300">Cláusulas em destaque</p>
        {termo.destaques.map((d) => (
          <div key={d.clausula} className="text-[13px] text-[#F0ECE4] whitespace-pre-wrap leading-relaxed border-l-2 border-red-500/40 pl-3">{d.texto}</div>
        ))}
      </div>

      <div className="rounded-xl border border-[#162744] bg-[#09081A] p-5 max-h-[420px] overflow-y-auto" tabIndex={0} aria-label="Texto integral do termo">
        <pre className="whitespace-pre-wrap font-[inherit] text-[13px] text-[#7A8FA8] leading-relaxed">{termo.texto}</pre>
      </div>

      <div className="rounded-xl border border-[#162744] bg-[#111F35] p-5 space-y-3">
        {[
          { id: "aceite-geral", v: geral, set: setGeral, t: `Li, compreendi e aceito integralmente o Termo de Uso da API de Propostas de Crédito da V3 Partners, versão ${termo.versao}.` },
          { id: "aceite-destaques", v: destaques, set: setDestaques, t: "Li e aceito, em especial, as cláusulas em destaque: autorização para consultas de crédito (4.8), proibição de cobrança antecipada (4.9), suspensão de comissão em caso de fraude (11.4), limitação de responsabilidade (12.4 e 12.5), multa (12.7) e compensação (12.8)." },
          { id: "aceite-poderes", v: poderes, set: setPoderes, t: "Declaro que tenho poderes para aceitar este termo em nome do partner." },
        ].map((c) => (
          <label key={c.id} htmlFor={c.id} className="flex gap-3 items-start text-[13px] text-[#F0ECE4] cursor-pointer">
            <input id={c.id} type="checkbox" checked={c.v} onChange={(e) => c.set(e.target.checked)} className="mt-1 accent-[#C9A84C]" />
            <span>{c.t}</span>
          </label>
        ))}
        <p className="text-[11px] text-[#7A8FA8]">O aceite fica registrado com a versão e o hash do texto, data e hora, IP, navegador e dispositivo.</p>
        {erro && <p className="text-xs text-red-300">{erro}</p>}
        <div className="flex justify-end">
          <BotaoV3 tipo="primario" disabled={!geral || !destaques || !poderes || enviando} onClick={aceitar}>
            {enviando ? "Registrando..." : "Aceitar o termo"}
          </BotaoV3>
        </div>
      </div>
    </section>
  );
}

function Chaves({ dados, onMudou }: { dados: Dados; onMudou: () => void }) {
  const [criando, setCriando] = useState(false);
  const [revogar, setRevogar] = useState<Chave | null>(null);
  const chaves = dados.chaves ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-[#7A8FA8]">
          <ShieldCheck size={14} className="text-[#C9A84C]" /> Termo versão {dados.termo?.versao} aceito.
          <a href="/api/integracao-api/comprovante" className="inline-flex items-center gap-1 text-[#E8C97A] hover:underline"><Download size={12} /> Baixar comprovante do aceite</a>
        </div>
        <BotaoV3 tipo="primario" onClick={() => setCriando(true)}><span className="inline-flex items-center gap-1.5"><KeyRound size={13} /> Criar chave</span></BotaoV3>
      </div>

      {chaves.length === 0 ? (
        <div className="rounded-xl border border-[#162744] bg-[#111F35] p-8 text-center text-sm text-[#7A8FA8]">
          Nenhuma chave criada. Crie uma chave para conectar o sistema da sua empresa à V3.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#162744]">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="bg-[#111F35]">
              <tr className="text-left text-[9px] font-bold tracking-[0.12em] uppercase text-[#C9A84C]">
                <th className="px-4 py-3">Chave</th><th className="px-4 py-3">Permissões</th><th className="px-4 py-3">IPs</th>
                <th className="px-4 py-3">Criada em</th><th className="px-4 py-3">Vence em</th><th className="px-4 py-3">Último uso</th>
                <th className="px-4 py-3">Situação</th><th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {chaves.map((k) => {
                const s = situacao(k);
                return (
                  <tr key={k.id} className="border-t border-[#162744] align-top">
                    <td className="px-4 py-3"><div className="text-[#F0ECE4] font-semibold">{k.nome}</div><div className="font-mono text-[11px] text-[#7A8FA8]">{k.prefixo}…</div></td>
                    <td className="px-4 py-3 text-[#7A8FA8]">{k.escopos.map((e) => ROTULO_ESCOPO[e] ?? e).join("; ")}</td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#7A8FA8]">{k.ips_permitidos.join(", ")}</td>
                    <td className="px-4 py-3 tabular-nums text-[#7A8FA8]">{dataBR(k.created_at)}</td>
                    <td className="px-4 py-3 tabular-nums text-[#7A8FA8]">{dataBR(k.expira_em)}</td>
                    <td className="px-4 py-3 tabular-nums text-[#7A8FA8]">{k.ultimo_uso_em ? `${dataBR(k.ultimo_uso_em, true)}${k.ultimo_ip ? ` · ${k.ultimo_ip}` : ""}` : "Nunca usada"}</td>
                    <td className="px-4 py-3"><span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}>{s.rotulo}</span>{k.revogada_em && k.motivo_revogacao && <div className="text-[11px] text-[#7A8FA8] mt-1">{k.motivo_revogacao}</div>}</td>
                    <td className="px-4 py-3 text-right">{s.rotulo === "Ativa" && <BotaoV3 onClick={() => setRevogar(k)}>Revogar</BotaoV3>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <CriarChave aberto={criando} ipAtual={dados.ip_atual ?? null} onFechar={() => { setCriando(false); onMudou(); }} />
      <RevogarChave chave={revogar} onFechar={(mudou) => { setRevogar(null); if (mudou) onMudou(); }} />
    </section>
  );
}

function CriarChave({ aberto, ipAtual, onFechar }: { aberto: boolean; ipAtual: string | null; onFechar: () => void }) {
  const [passo, setPasso] = useState<"dados" | "codigo" | "pronta">("dados");
  const [nome, setNome] = useState("");
  const [ips, setIps] = useState("");
  const [escopos, setEscopos] = useState<string[]>(["propostas:criar", "propostas:ler"]);
  const [codigo, setCodigo] = useState("");
  const [enviadoPara, setEnviadoPara] = useState("");
  const [chave, setChave] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const listaIps = useMemo(() => ips.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean), [ips]);

  function limpar() {
    setPasso("dados"); setNome(""); setIps(""); setEscopos(["propostas:criar", "propostas:ler"]);
    setCodigo(""); setChave(null); setCopiado(false); setErro(null);
  }

  async function pedirCodigo() {
    setCarregando(true); setErro(null);
    const r = await fetch("/api/integracao-api/codigo", { method: "POST" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setCarregando(false);
    if (!r?.ok) { setErro(j.error ?? "Não foi possível enviar o código."); return; }
    setEnviadoPara(j.enviado_para ?? "seu e-mail"); setPasso("codigo");
  }

  async function criar() {
    setCarregando(true); setErro(null);
    const r = await fetch("/api/integracao-api/chaves", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, ips: listaIps, escopos, codigo }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setCarregando(false);
    if (!r?.ok) { setErro(j.error ?? "Não foi possível criar a chave."); return; }
    setChave(j.chave); setPasso("pronta");
  }

  async function copiar() {
    if (!chave) return;
    try { await navigator.clipboard.writeText(chave); setCopiado(true); } catch { setErro("Não foi possível copiar. Selecione o texto da chave e copie manualmente."); }
  }

  const fechar = () => { limpar(); onFechar(); };

  return (
    <ModalV3 aberto={aberto} titulo={passo === "pronta" ? "Chave criada" : "Criar chave de API"}
      rodape={passo === "dados" ? (<>
        <BotaoV3 onClick={fechar}>Cancelar</BotaoV3>
        <BotaoV3 tipo="primario" disabled={carregando || nome.trim().length < 3 || listaIps.length === 0 || listaIps.length > 10 || escopos.length === 0} onClick={pedirCodigo}>
          {carregando ? "Enviando..." : "Enviar código por e-mail"}
        </BotaoV3>
      </>) : passo === "codigo" ? (<>
        <BotaoV3 onClick={fechar}>Cancelar</BotaoV3>
        <BotaoV3 tipo="primario" disabled={carregando || !/^\d{6}$/.test(codigo)} onClick={criar}>{carregando ? "Criando..." : "Criar chave"}</BotaoV3>
      </>) : (
        <BotaoV3 tipo="primario" disabled={!copiado} onClick={fechar}>Já copiei, fechar</BotaoV3>
      )}>
      {passo === "dados" && (<>
        <label htmlFor="chave-nome" className="block text-[11px] font-semibold text-[#F0ECE4]">Nome da chave</label>
        <input id="chave-nome" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} placeholder="Sistema da corretora"
          className="w-full rounded-lg bg-[#111F35] border border-[#162744] px-3 py-2 text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]" />
        <label htmlFor="chave-ips" className="block text-[11px] font-semibold text-[#F0ECE4]">IPs permitidos (de 1 a 10, um por linha)</label>
        <textarea id="chave-ips" value={ips} onChange={(e) => setIps(e.target.value)} rows={3} placeholder="200.150.10.20"
          className="w-full rounded-lg bg-[#111F35] border border-[#162744] px-3 py-2 font-mono text-[12px] text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]" />
        <p className="text-[11px]">Use o IP fixo de saída do servidor do seu sistema, que o seu dev informa. {ipAtual && <>O IP deste computador agora é <span className="font-mono text-[#E8C97A]">{ipAtual}</span>; só use se o sistema rodar aqui.</>}</p>
        <fieldset className="space-y-2">
          <legend className="text-[11px] font-semibold text-[#F0ECE4]">Permissões</legend>
          {Object.entries(ROTULO_ESCOPO).map(([id, rotulo]) => (
            <label key={id} htmlFor={`esc-${id}`} className="flex items-center gap-2 cursor-pointer">
              <input id={`esc-${id}`} type="checkbox" className="accent-[#C9A84C]" checked={escopos.includes(id)}
                onChange={(e) => setEscopos((v) => e.target.checked ? [...v, id] : v.filter((x) => x !== id))} />
              <span className="text-[#F0ECE4]">{rotulo}</span>
            </label>
          ))}
        </fieldset>
        <p className="text-[11px]">A chave vale 12 meses. Para criar, enviamos um código de confirmação ao e-mail da sua conta.</p>
      </>)}
      {passo === "codigo" && (<>
        <p>Enviamos um código de 6 dígitos para <b className="text-[#F0ECE4]">{enviadoPara}</b>. Ele vale por 10 minutos.</p>
        <label htmlFor="chave-codigo" className="block text-[11px] font-semibold text-[#F0ECE4]">Código</label>
        <input id="chave-codigo" inputMode="numeric" autoComplete="one-time-code" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="w-40 rounded-lg bg-[#111F35] border border-[#162744] px-3 py-2 font-mono text-lg tracking-[0.3em] text-[#F0ECE4] focus:outline-none focus:border-[#C9A84C]" />
      </>)}
      {passo === "pronta" && chave && (<>
        <p className="text-[#F0ECE4] font-semibold">Copie agora. Por segurança, não mostramos esta chave de novo.</p>
        <div className="rounded-lg bg-[#111F35] border border-[#C9A84C]/40 p-3 font-mono text-[12px] text-[#E8C97A] break-all select-all">{chave}</div>
        <BotaoV3 onClick={copiar}><span className="inline-flex items-center gap-1.5"><Copy size={12} /> {copiado ? "Copiada" : "Copiar chave"}</span></BotaoV3>
        <p className="text-[11px]">Entregue ao seu dev por um canal seguro. Ele guarda a chave só no servidor, nunca em site, aplicativo, planilha ou e-mail.</p>
      </>)}
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </ModalV3>
  );
}

function RevogarChave({ chave, onFechar }: { chave: Chave | null; onFechar: (mudou: boolean) => void }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function revogar() {
    if (!chave) return;
    setCarregando(true); setErro(null);
    const r = await fetch(`/api/integracao-api/chaves/${chave.id}/revogar`, { method: "POST" }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setCarregando(false);
    if (!r?.ok) { setErro(j.error ?? "Não foi possível revogar."); return; }
    onFechar(true);
  }
  return (
    <ModalV3 aberto={!!chave} perigo titulo="Revogar chave?"
      rodape={<><BotaoV3 onClick={() => { setErro(null); onFechar(false); }}>Cancelar</BotaoV3><BotaoV3 tipo="perigo" disabled={carregando} onClick={revogar}>{carregando ? "Revogando..." : "Revogar"}</BotaoV3></>}>
      <p>Os sistemas que usam a chave <b className="text-[#F0ECE4]">{chave?.nome}</b> ({chave?.prefixo}…) param de funcionar na hora. Esta ação não pode ser desfeita.</p>
      {erro && <p className="text-xs text-red-300">{erro}</p>}
    </ModalV3>
  );
}
