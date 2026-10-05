"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, ExternalLink, Clock, Sparkles, AlertTriangle, Loader2, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";

// Painel "Documentos da Análise Estruturada" no detalhe do pedido (Mesa). Só aparece
// em pedido do pacote V3 Access; para os demais a API responde ativo=false.
// Entrega 2: leitura dos documentos (IA / OFX), checagens automáticas e correção da Mesa.

interface Validacao { regra: string; ok: boolean | null; detalhe: string }
interface Leitura {
  status: "lido" | "erro" | "nao_suportado";
  origem: "ofx" | "ia" | null;
  lido_em: string;
  dados: Record<string, unknown> | null;
  validacoes: Validacao[];
  erro: string | null;
  revisado_por: string | null;
  revisado_em: string | null;
}
interface Arquivo { nome: string; caminho: string; enviado_em: string | null; url: string | null; leitura: Leitura | null }
interface Item { key: string; label: string; obrigatorio: boolean; arquivos: Arquivo[] }
interface Resposta {
  ativo: boolean;
  completo?: boolean;
  completo_em?: string | null;
  prazo_entrega?: string | null;
  obrigatorios_faltando?: number;
  itens?: Item[];
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

// ── Edição campo a campo: o JSON extraído vira uma lista de (caminho, valor) ──
type Campo = { caminho: (string | number)[]; valor: unknown };

function achatar(v: unknown, caminho: (string | number)[] = []): Campo[] {
  if (Array.isArray(v)) return v.flatMap((x, i) => achatar(x, [...caminho, i]));
  if (v && typeof v === "object") return Object.entries(v as Record<string, unknown>).flatMap(([k, x]) => achatar(x, [...caminho, k]));
  return [{ caminho, valor: v }];
}

function definir(obj: unknown, caminho: (string | number)[], valor: unknown): unknown {
  if (!caminho.length) return valor;
  const [k, ...resto] = caminho;
  const base = Array.isArray(obj) ? [...obj] : { ...(obj as Record<string, unknown>) };
  (base as Record<string | number, unknown>)[k] = definir((obj as Record<string | number, unknown>)?.[k], resto, valor);
  return base;
}

function rotuloCampo(caminho: (string | number)[]): string {
  return caminho.map((p) => (typeof p === "number" ? `#${p + 1}` : p.replace(/_/g, " "))).join(" › ");
}

function paraNumero(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const normal = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t;
  const x = Number(normal);
  return Number.isFinite(x) ? x : null;
}

function EditorDados({ arquivo, orderId, aoSalvar }: { arquivo: Arquivo; orderId: string; aoSalvar: (l: Leitura) => void }) {
  const leitura = arquivo.leitura!;
  const [dados, setDados] = useState<unknown>(leitura.dados ?? {});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const campos = achatar(dados);

  async function salvar() {
    setSalvando(true); setErro("");
    try {
      const r = await fetch(`/api/analise-estruturada/pedido/${orderId}/leitura`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caminho: arquivo.caminho, dados }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar.");
      aoSalvar(d.resultado as Leitura);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="max-h-80 overflow-y-auto rounded-lg border border-border/50">
        <table className="w-full text-xs">
          <tbody>
            {campos.map((c) => {
              const chave = c.caminho.join(".");
              const ehNumero = typeof c.valor === "number";
              const ehBool = typeof c.valor === "boolean";
              return (
                <tr key={chave} className="border-b border-border/30 last:border-0">
                  <td className="px-2 py-1 text-muted-foreground align-top w-1/2">{rotuloCampo(c.caminho)}</td>
                  <td className="px-2 py-1">
                    {ehBool ? (
                      <select value={String(c.valor)} onChange={(e) => setDados((d: unknown) => definir(d, c.caminho, e.target.value === "true"))}
                        className="w-full bg-secondary/40 rounded px-1 py-0.5 text-foreground">
                        <option value="true">sim</option><option value="false">não</option>
                      </select>
                    ) : (
                      <input
                        defaultValue={c.valor == null ? "" : ehNumero ? (c.valor as number).toLocaleString("pt-BR", { maximumFractionDigits: 2 }) : String(c.valor)}
                        onBlur={(e) => {
                          const v = e.target.value;
                          setDados((d: unknown) => definir(d, c.caminho, ehNumero || (c.valor == null && /^[\d.,-]+$/.test(v)) ? paraNumero(v) : v.trim() || null));
                        }}
                        className="w-full bg-secondary/40 rounded px-1 py-0.5 text-foreground"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {erro && <p className="text-xs text-red-400">{erro}</p>}
      <button onClick={salvar} disabled={salvando}
        className="px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-50">
        {salvando ? "Salvando…" : "Salvar correção"}
      </button>
    </div>
  );
}

function SeloLeitura({ leitura }: { leitura: Leitura | null }) {
  if (!leitura) return <span className="text-[10px] text-muted-foreground">não lido</span>;
  if (leitura.status === "nao_suportado") return <span className="text-[10px] text-muted-foreground">leitura manual</span>;
  if (leitura.status === "erro") return <span className="text-[10px] text-red-400">erro na leitura</span>;
  const alertas = leitura.validacoes.filter((v) => v.ok === false).length;
  return alertas
    ? <span className="text-[10px] text-amber-400 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{alertas} alerta{alertas > 1 ? "s" : ""}</span>
    : <span className="text-[10px] text-[#C9A84C] inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />lido{leitura.origem === "ofx" ? " (OFX)" : ""}</span>;
}

export function DocumentosAnaliseEstruturada({ orderId }: { orderId: string }) {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [lendo, setLendo] = useState<{ atual: number; total: number } | null>(null);
  const [lendoUm, setLendoUm] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/api/analise-estruturada/pedido/${orderId}`);
      setDados(await r.json());
    } catch {
      setDados({ ativo: false });
    }
  }, [orderId]);

  useEffect(() => { carregar(); }, [carregar]);

  function atualizarLeitura(caminho: string, leitura: Leitura) {
    setDados((d) => d && ({
      ...d,
      itens: d.itens?.map((i) => ({ ...i, arquivos: i.arquivos.map((a) => (a.caminho === caminho ? { ...a, leitura } : a)) })),
    }));
  }

  async function lerUm(caminho: string) {
    const r = await fetch(`/api/analise-estruturada/pedido/${orderId}/leitura`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminho }),
    });
    const d = await r.json();
    if (r.ok && d.resultado) atualizarLeitura(caminho, d.resultado as Leitura);
  }

  async function lerPendentes() {
    const pendentes = (dados?.itens ?? []).flatMap((i) => i.arquivos).filter((a) => !a.leitura || a.leitura.status === "erro");
    if (!pendentes.length) return;
    setLendo({ atual: 0, total: pendentes.length });
    for (let i = 0; i < pendentes.length; i++) {
      setLendo({ atual: i + 1, total: pendentes.length });
      await lerUm(pendentes[i].caminho).catch(() => {});
    }
    setLendo(null);
  }

  if (!dados?.ativo) return null;
  const atrasado = dados.prazo_entrega ? new Date(dados.prazo_entrega).getTime() < Date.now() : false;
  const arquivos = (dados.itens ?? []).flatMap((i) => i.arquivos);
  const pendentes = arquivos.filter((a) => !a.leitura || a.leitura.status === "erro").length;

  return (
    <div className="rounded-xl border border-[#C9A84C]/30 bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Análise Estruturada V3 · documentos do cliente</p>
          <p className="text-sm font-semibold text-foreground">
            {dados.completo
              ? "Obrigatórios completos"
              : `Faltam ${dados.obrigatorios_faltando} obrigatório${dados.obrigatorios_faltando === 1 ? "" : "s"}`}
          </p>
        </div>
        {dados.prazo_entrega && (
          <div className={`flex items-center gap-1.5 text-xs font-semibold ${atrasado ? "text-red-400" : "text-[#E8C97A]"}`}>
            <Clock className="w-3.5 h-3.5" />
            {atrasado ? "Prazo vencido em " : "Entregar até "}{fmt(dados.prazo_entrega)}
          </div>
        )}
      </div>
      {dados.completo_em && (
        <p className="text-[11px] text-muted-foreground">Documentos completos em {fmt(dados.completo_em)} (início do prazo de 24h).</p>
      )}

      {arquivos.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={lerPendentes} disabled={!!lendo || pendentes === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold disabled:opacity-50">
            {lendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {lendo ? `Lendo ${lendo.atual} de ${lendo.total}…` : pendentes ? `Ler ${pendentes} documento${pendentes > 1 ? "s" : ""} com IA` : "Todos os documentos lidos"}
          </button>
          <span className="text-[11px] text-muted-foreground">A IA só extrai os números; as conferências são por fórmula. Corrija o que estiver diferente do documento.</span>
        </div>
      )}

      <div className="space-y-2">
        {(dados.itens ?? []).map((item) => (
          <div key={item.key} className="rounded-lg border border-border/50 p-3">
            <div className="flex items-center gap-2 text-sm">
              {item.arquivos.length > 0
                ? <CheckCircle2 className="w-4 h-4 text-[#C9A84C] shrink-0" />
                : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="text-foreground font-medium">{item.label}</span>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{item.obrigatorio ? "obrigatório" : "opcional"}</span>
            </div>
            {item.arquivos.length > 0 && (
              <ul className="mt-2 space-y-2 pl-6">
                {item.arquivos.map((a) => {
                  const expandido = aberto === a.caminho;
                  return (
                    <li key={a.caminho} className="text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.url ? (
                          <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[#E8C97A] hover:underline inline-flex items-center gap-1 truncate max-w-[16rem]">
                            {a.nome} <ExternalLink className="w-3 h-3 shrink-0" />
                          </a>
                        ) : <span className="text-muted-foreground truncate">{a.nome}</span>}
                        <SeloLeitura leitura={a.leitura} />
                        {a.leitura?.status === "lido" && (
                          <button onClick={() => setAberto(expandido ? null : a.caminho)} className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground">
                            {expandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}{expandido ? "fechar" : "ver dados"}
                          </button>
                        )}
                        <button
                          onClick={async () => { setLendoUm(a.caminho); await lerUm(a.caminho).catch(() => {}); setLendoUm(null); }}
                          disabled={!!lendo || lendoUm === a.caminho}
                          className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground disabled:opacity-50"
                          title={a.leitura ? "Ler de novo (substitui a correção da Mesa)" : "Ler este arquivo"}
                        >
                          {lendoUm === a.caminho ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}{a.leitura ? "reler" : "ler"}
                        </button>
                      </div>
                      {a.leitura?.erro && <p className="mt-1 text-[11px] text-red-400">{a.leitura.erro}</p>}
                      {expandido && a.leitura && (
                        <div className="mt-2 rounded-lg bg-secondary/20 p-3 space-y-2">
                          {a.leitura.validacoes.length > 0 && (
                            <ul className="space-y-1">
                              {a.leitura.validacoes.map((v, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  {v.ok === true ? <CheckCircle2 className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-px" />
                                    : v.ok === false ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-px" />
                                    : <Circle className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-px" />}
                                  <span><strong className="text-foreground">{v.regra}:</strong> <span className="text-muted-foreground">{v.detalhe}</span></span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {a.leitura.revisado_por && (
                            <p className="text-[11px] text-muted-foreground">Corrigido por {a.leitura.revisado_por}{a.leitura.revisado_em ? ` em ${fmt(a.leitura.revisado_em)}` : ""}.</p>
                          )}
                          <EditorDados key={a.leitura.revisado_em ?? a.leitura.lido_em} arquivo={a} orderId={orderId} aoSalvar={(l) => atualizarLeitura(a.caminho, l)} />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
