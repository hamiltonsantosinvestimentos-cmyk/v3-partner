"use client";

// Avaliação Técnica V3 do imóvel em garantia — aba Avaliação de Imóvel do modal da proposta
// (17/10/2026). Mostra o que a rota /api/credit-proposals/avaliacao-imovel/tecnica montou a
// partir dos documentos (matrícula, IPTU, CCIR, ITR, CAR, GEO, fotos, laudo) + internet, no
// formato dos laudos de referência: valores, rating, alertas, registro, áreas, características,
// GEO com a poligonal, mercado e parecer.

import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle, AlertTriangle, CheckCircle2, Download, ExternalLink, FileText, Info, Loader2, MapPin, Paperclip, RefreshCw, ShieldCheck, Sparkles,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { gerarKml } from "@/lib/avaliacao-tecnica/geo";
import { TIPO_DOC_LABEL, type Alerta, type AvaliacaoTecnica, type Poligonal } from "@/lib/avaliacao-tecnica/tipos";
import { diasDesde } from "@/lib/avaliacao-tecnica/analise";

export interface JobAvaliacaoTecnica {
  status: "PROCESSANDO" | "CONCLUIDO" | "ERRO";
  iniciado_em?: string;
  concluido_em?: string;
  etapa?: string;
  erro?: string;
  ignorados?: string[];
}

export interface ArquivoDoImovel { doc_id: string; label: string; nome: string }

interface Props {
  proposalId: string;
  idx: number;
  avaliacao?: AvaliacaoTecnica | null;
  job?: JobAvaliacaoTecnica | null;
  zona?: string | null;
  /** Itens do checklist da proposta (doc_id + rótulo) — o servidor separa os do imóvel. */
  itens: { doc_id: string; label: string }[];
  /** Arquivos já anexados que parecem ser do imóvel (prévia antes de gerar). */
  arquivosImovel: ArquivoDoImovel[];
  valorSolicitado?: number | null;
  onAnexar: (file: File) => Promise<void>;
  onMetadata: (metadata: Record<string, unknown>) => void;
  onUsarValor: (valor: number) => void;
}

const JOB_EXPIRA_MS = 6 * 60 * 1000;
const OURO = "#C9A84C";

const n = (v: number | null | undefined, casas = 2) => (typeof v === "number" && Number.isFinite(v) ? v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }) : "—");
const data = (iso?: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("pt-BR");
};
const txt = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : String(v));

const ACEITE_LABEL = { ACEITAR: "Aceitar", ACEITAR_COM_RESSALVAS: "Aceitar com ressalvas", NAO_RECOMENDADO: "Não recomendado" } as const;

function Linha({ rotulo, valor, destaque }: { rotulo: string; valor: React.ReactNode; destaque?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-[#243A66]/40 last:border-0">
      <span className="text-[10px] uppercase tracking-wider text-[#7A8FA8] shrink-0">{rotulo}</span>
      <span className={`text-[11px] text-right ${destaque ? "font-semibold text-[#E8C97A]" : "text-[#F0ECE4]"}`}>{valor}</span>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#243A66]/60 bg-[#111F35]/60 p-3 space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#C9A84C] mb-1">{titulo}</p>
      {children}
    </div>
  );
}

function Chips({ itens }: { itens?: (string | null | undefined)[] | null }) {
  const lista = (itens ?? []).filter(Boolean) as string[];
  if (lista.length === 0) return <span className="text-[11px] text-[#7A8FA8]">—</span>;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {lista.map((t, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-[#243A66]/50 text-[10px] text-[#F0ECE4]">{t}</span>)}
    </div>
  );
}

function IconeAlerta({ nivel }: { nivel: Alerta["nivel"] }) {
  if (nivel === "CRITICO") return <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />;
  if (nivel === "ATENCAO") return <AlertTriangle className="w-3.5 h-3.5 text-[#E8C97A] shrink-0 mt-0.5" />;
  return <Info className="w-3.5 h-3.5 text-[#7A8FA8] shrink-0 mt-0.5" />;
}

/** Desenho da poligonal do GEO (projeção simples lat/long, norte para cima). */
function DesenhoPoligonal({ p }: { p: Poligonal }) {
  const W = 320;
  const H = 210;
  const pad = 14;
  const k = Math.cos((p.centroide.lat * Math.PI) / 180);
  const xs = p.vertices.map((v) => v.lon * k);
  const ys = p.vertices.map((v) => v.lat);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const esc = Math.min((W - 2 * pad) / (x1 - x0 || 1), (H - 2 * pad) / (y1 - y0 || 1));
  const ox = (W - (x1 - x0) * esc) / 2;
  const oy = (H - (y1 - y0) * esc) / 2;
  const pts = p.vertices.map((v, i) => [ox + (xs[i] - x0) * esc, H - (oy + (ys[i] - y0) * esc)] as const);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto rounded-lg bg-[#09081A] border border-[#243A66]/60" role="img" aria-label="Poligonal do imóvel pelo GEO">
      <defs>
        <pattern id="grade-geo" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#243A66" strokeWidth="0.4" /></pattern>
      </defs>
      <rect width={W} height={H} fill="url(#grade-geo)" />
      <polygon points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill={`${OURO}26`} stroke={OURO} strokeWidth="1.6" strokeLinejoin="round" />
      {pts.length <= 120 && pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.6" fill="#E8C97A" />)}
      <g transform={`translate(${W - 20},22)`}>
        <path d="M0,-12 L5,4 L0,0 L-5,4 Z" fill="#F0ECE4" />
        <text y="15" textAnchor="middle" fontSize="8" fill="#7A8FA8">N</text>
      </g>
    </svg>
  );
}

export function AvaliacaoTecnicaCard({ proposalId, idx, avaliacao, job, zona, itens, arquivosImovel, valorSolicitado, onAnexar, onMetadata, onUsarValor }: Props) {
  const [aba, setAba] = useState<"resumo" | "registro" | "areas" | "caracteristicas" | "geo" | "mercado" | "documentos">("resumo");
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [anexando, setAnexando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processando = job?.status === "PROCESSANDO" && !!job.iniciado_em && Date.now() - new Date(job.iniciado_em).getTime() < JOB_EXPIRA_MS;
  const expirou = job?.status === "PROCESSANDO" && !processando;

  // Acompanha o processamento em segundo plano.
  useEffect(() => {
    if (!processando) return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/credit-proposals/avaliacao-imovel/tecnica?proposal_id=${proposalId}`);
        const j = await r.json();
        if (r.ok && j.metadata) onMetadata(j.metadata);
      } catch { /* tenta de novo no próximo ciclo */ }
    }, 5000);
    return () => clearInterval(t);
  }, [processando, proposalId, onMetadata]);

  async function gerar() {
    setErro(null);
    setIniciando(true);
    try {
      const r = await fetch("/api/credit-proposals/avaliacao-imovel/tecnica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposal_id: proposalId, imovel_idx: idx, itens }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErro(typeof j.error === "string" ? j.error : "Erro ao iniciar a avaliação."); return; }
      if (j.metadata) onMetadata(j.metadata);
    } catch {
      setErro("Falha de conexão ao iniciar a avaliação.");
    } finally {
      setIniciando(false);
    }
  }

  async function anexar(files: FileList | null) {
    if (!files || files.length === 0) return;
    setAnexando(true);
    try { for (const f of Array.from(files)) await onAnexar(f); } finally {
      setAnexando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function baixarKml(p: Poligonal) {
    const nome = avaliacao?.identificacao.denominacao || `Matrícula ${avaliacao?.identificacao.matricula ?? ""}`.trim();
    const blob = new Blob([gerarKml(nome || "Imóvel", p.vertices)], { type: "application/vnd.google-earth.kml+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(nome || "imovel").replace(/[^\w\-]+/g, "_")}.kml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ehRural = (avaliacao?.zona ?? zona) === "RURAL";
  const docsEsperados = ehRural ? "matrícula, GEO/memorial SIGEF, CCIR, ITR, CAR e fotos" : "matrícula, IPTU e fotos (internet para mercado e região)";

  // ── Cabeçalho e ações ──
  const cabecalho = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C9A84C] flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Avaliação Técnica V3
          <span className="px-1.5 py-0.5 rounded border border-[#C9A84C]/40 text-[8px] tracking-wider">{ehRural ? "RURAL · NBR 14653-3" : "URBANO · NBR 14653-2"}</span>
        </p>
        <p className="text-[11px] text-[#7A8FA8] mt-1">
          {avaliacao
            ? <>Gerada em {new Date(avaliacao.gerado_em).toLocaleString("pt-BR")}{avaliacao.gerado_por ? ` por ${avaliacao.gerado_por}` : ""} · {avaliacao.arquivos.length} documento(s) lido(s)</>
            : <>Lê {docsEsperados} e monta a avaliação no padrão dos laudos.</>}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <input ref={inputRef} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.kml" className="hidden" onChange={(e) => anexar(e.target.files)} />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={anexando || processando}
          title="Anexar matrícula, IPTU, GEO, CCIR, ITR, CAR, KML, fotos ou laudo direto aqui"
          className="h-7 px-2 rounded-md border border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#C9A84C]/50 text-[11px] flex items-center gap-1 transition-colors disabled:opacity-40"
        >
          {anexando ? <Loader2 className="w-3 h-3 animate-spin" /> : <Paperclip className="w-3 h-3" />} Anexar
        </button>
        <button
          onClick={gerar}
          disabled={iniciando || processando}
          className="h-7 px-2.5 rounded-md bg-gradient-to-r from-[#C9A84C] to-[#E8C97A] text-[#09081A] text-[11px] font-bold flex items-center gap-1 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {iniciando || processando ? <Loader2 className="w-3 h-3 animate-spin" /> : avaliacao ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
          {avaliacao ? "Reavaliar" : "Gerar avaliação"}
        </button>
      </div>
    </div>
  );

  const estado = (
    <>
      {processando && (
        <div className="rounded-lg border border-[#C9A84C]/30 bg-[#C9A84C]/5 p-3 flex items-center gap-2.5">
          <Loader2 className="w-4 h-4 animate-spin text-[#C9A84C] shrink-0" />
          <div>
            <p className="text-[11px] font-semibold text-[#F0ECE4]">{job?.etapa ?? "Processando"}…</p>
            <p className="text-[10px] text-[#7A8FA8]">Leva de 2 a 4 minutos. Pode fechar o modal: a avaliação continua e fica salva na proposta.</p>
          </div>
        </div>
      )}
      {(job?.status === "ERRO" || expirou || erro) && !processando && (
        <p className="text-[11px] text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          {erro ?? (expirou ? "A avaliação anterior não terminou (tempo esgotado). Gere de novo." : job?.erro)}
        </p>
      )}
    </>
  );

  if (!avaliacao) {
    return (
      <div className="rounded-xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#162744] to-[#111F35] p-3.5 space-y-3">
        {cabecalho}
        {estado}
        <div className="rounded-lg border border-dashed border-[#243A66] p-3">
          <p className="text-[10px] uppercase tracking-wider text-[#7A8FA8] mb-1.5">Documentos do imóvel encontrados ({arquivosImovel.length})</p>
          {arquivosImovel.length === 0
            ? <p className="text-[11px] text-[#7A8FA8] italic">Nenhum ainda. Anexe nos Documentos da proposta ou aqui pelo botão Anexar.</p>
            : (
              <div className="flex flex-wrap gap-1">
                {arquivosImovel.slice(0, 18).map((a, i) => (
                  <span key={i} title={a.label} className="px-1.5 py-0.5 rounded bg-[#243A66]/50 text-[10px] text-[#F0ECE4] max-w-[220px] truncate">{a.nome}</span>
                ))}
                {arquivosImovel.length > 18 && <span className="text-[10px] text-[#7A8FA8]">+{arquivosImovel.length - 18}</span>}
              </div>
            )}
        </div>
      </div>
    );
  }

  const av = avaliacao;
  const v = av.valores;
  const un = v.unidade === "ha" ? "ha" : "m²";
  const ltvLiq = valorSolicitado && v.valor_liquidez ? valorSolicitado / v.valor_liquidez : null;
  const ltvMerc = valorSolicitado && v.valor_mercado ? valorSolicitado / v.valor_mercado : null;
  const notaCor = av.rating.nota === "A" || av.rating.nota === "B" ? "text-[#E8C97A] border-[#E8C97A]/60" : av.rating.nota === "C" ? "text-[#C9A84C] border-[#C9A84C]/60" : "text-red-300 border-red-400/60";
  const criticos = av.alertas.filter((a) => a.nivel === "CRITICO").length;
  const atencao = av.alertas.filter((a) => a.nivel === "ATENCAO").length;
  const diasMatricula = diasDesde(av.identificacao.data_certidao);
  const mapsUrl = av.localizacao ? `https://www.google.com/maps?q=${av.localizacao.lat},${av.localizacao.lon}&t=k` : null;

  const abas: { id: typeof aba; label: string }[] = [
    { id: "resumo", label: "Resumo" },
    { id: "registro", label: "Registro" },
    { id: "areas", label: "Áreas" },
    { id: "caracteristicas", label: ehRural ? "Cadastros e campo" : "Construção" },
    { id: "geo", label: ehRural ? "GEO" : "Localização" },
    { id: "mercado", label: "Mercado" },
    { id: "documentos", label: `Documentos (${av.arquivos.length})` },
  ];

  return (
    <div className="rounded-xl border border-[#C9A84C]/30 bg-gradient-to-br from-[#162744] to-[#111F35] p-3.5 space-y-3">
      {cabecalho}
      {estado}

      {/* ── Faixa de valores + rating ── */}
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            ["Valor de mercado", v.valor_mercado !== null ? formatCurrency(v.valor_mercado) : "—", v.preco_unitario_aplicado ? `${formatCurrency(v.preco_unitario_aplicado)}/${un}` : "sem comparáveis"],
            ["Valor de liquidez", v.valor_liquidez !== null ? formatCurrency(v.valor_liquidez) : "—", `fator ${n(v.fator_liquidez)} (garantia)`],
            ["LTV s/ liquidez", ltvLiq !== null ? `${n(ltvLiq * 100, 1)}%` : "—", ltvMerc !== null ? `${n(ltvMerc * 100, 1)}% s/ mercado` : "máx. 70%"],
            ["Área considerada", v.area_considerada ? `${n(v.area_considerada, v.unidade === "ha" ? 4 : 2)} ${un}` : "—", v.area_criterio],
          ].map(([rot, val, sub], i) => (
            <div key={i} className={`rounded-lg border px-2.5 py-2 ${i === 2 && ltvLiq !== null && ltvLiq > 0.7 ? "border-red-400/40 bg-red-500/5" : "border-[#243A66]/70 bg-[#09081A]/40"}`}>
              <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#C9A84C]">{rot}</p>
              <p className={`text-sm font-extrabold mt-0.5 ${i === 2 && ltvLiq !== null && ltvLiq > 0.7 ? "text-red-300" : "text-[#F0ECE4]"}`}>{val}</p>
              <p className="text-[9px] text-[#7A8FA8] truncate" title={String(sub)}>{sub}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center justify-center rounded-lg border border-[#243A66]/70 bg-[#09081A]/40 px-3" title="Rating da Garantia V3 (100 pontos: documentação, registro, áreas/GEO, ambiental/riscos, mercado)">
          <span className={`w-11 h-11 rounded-full border-2 flex items-center justify-center text-xl font-extrabold ${notaCor}`}>{av.rating.nota}</span>
          <span className="text-[9px] text-[#7A8FA8] mt-1">{av.rating.pontos}/100</span>
        </div>
      </div>

      {v.intervalo_inferior !== null && v.intervalo_superior !== null && v.valor_mercado !== null && (
        <div className="space-y-1">
          <div className="relative h-1.5 rounded-full bg-[#243A66]/60">
            <div className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#C9A84C]/40 to-[#E8C97A]/40" style={{ left: 0, right: 0 }} />
            <div
              className="absolute -top-1 w-3.5 h-3.5 rounded-full bg-[#E8C97A] border-2 border-[#09081A]"
              style={{ left: `calc(${Math.min(100, Math.max(0, ((v.valor_mercado - v.intervalo_inferior) / Math.max(1, v.intervalo_superior - v.intervalo_inferior)) * 100))}% - 7px)` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-[#7A8FA8]">
            <span>{formatCurrency(v.intervalo_inferior)}</span>
            <span>intervalo da amostra saneada ({v.amostra_saneada} de {v.amostra_total})</span>
            <span>{formatCurrency(v.intervalo_superior)}</span>
          </div>
        </div>
      )}

      {/* ── Referências oficiais e laudo ── */}
      {(v.valor_venal_iptu || v.vtn_itr || v.laudo_mercado) && (
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {v.valor_venal_iptu ? <span className="px-2 py-0.5 rounded bg-[#243A66]/50 text-[#F0ECE4]">Venal IPTU {formatCurrency(v.valor_venal_iptu)}</span> : null}
          {v.vtn_itr ? <span className="px-2 py-0.5 rounded bg-[#243A66]/50 text-[#F0ECE4]">VTN ITR {formatCurrency(v.vtn_itr)}</span> : null}
          {v.laudo_mercado ? <span className="px-2 py-0.5 rounded bg-[#C9A84C]/15 text-[#E8C97A]">Laudo {av.laudo_externo?.empresa ?? ""}: mercado {formatCurrency(v.laudo_mercado)}{v.laudo_garantia ? ` · garantia ${formatCurrency(v.laudo_garantia)}` : ""}</span> : null}
        </div>
      )}

      {/* ── Alertas ── */}
      {av.alertas.length > 0 && (
        <div className="rounded-lg border border-[#243A66]/60 bg-[#09081A]/40 p-2.5 space-y-1.5">
          <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#C9A84C]">
            Alertas · <span className="text-red-300">{criticos} crítico(s)</span> · <span className="text-[#E8C97A]">{atencao} atenção</span>
          </p>
          <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
            {av.alertas.map((a, i) => (
              <div key={i} className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${a.nivel === "CRITICO" ? "bg-red-500/10" : a.nivel === "ATENCAO" ? "bg-[#C9A84C]/[0.07]" : "bg-[#243A66]/25"}`}>
                <IconeAlerta nivel={a.nivel} />
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-[#F0ECE4]">{a.titulo} <span className="font-normal text-[9px] uppercase tracking-wider text-[#7A8FA8]">· {a.categoria}</span></p>
                  {a.detalhe && <p className="text-[10px] text-[#7A8FA8]">{a.detalhe}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Abas internas ── */}
      <div className="flex gap-1 overflow-x-auto border-b border-[#243A66]/70 -mx-0.5 px-0.5">
        {abas.map((t) => (
          <button
            key={t.id}
            onClick={() => setAba(t.id)}
            className={`px-2.5 py-1.5 text-[11px] whitespace-nowrap border-b-2 -mb-px transition-colors ${aba === t.id ? "border-[#C9A84C] text-[#E8C97A] font-semibold" : "border-transparent text-[#7A8FA8] hover:text-[#F0ECE4]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {aba === "resumo" && (
        <div className="space-y-2.5">
          <div className="rounded-lg border border-[#C9A84C]/25 bg-[#C9A84C]/[0.04] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#C9A84C]">Parecer técnico</p>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${av.parecer.aceite === "ACEITAR" ? "bg-[#E8C97A]/15 text-[#E8C97A]" : av.parecer.aceite === "NAO_RECOMENDADO" ? "bg-red-500/15 text-red-300" : "bg-[#C9A84C]/15 text-[#C9A84C]"}`}>
                {ACEITE_LABEL[av.parecer.aceite]}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#F0ECE4]">{av.parecer.resumo}</p>
            {([["Pontos fortes", av.parecer.pontos_fortes, <CheckCircle2 key="a" className="w-3 h-3 text-[#E8C97A] shrink-0 mt-0.5" />], ["Ressalvas", av.parecer.ressalvas, <AlertTriangle key="b" className="w-3 h-3 text-[#C9A84C] shrink-0 mt-0.5" />], ["Recomendações antes de aceitar", av.parecer.recomendacoes, <ShieldCheck key="c" className="w-3 h-3 text-[#7A8FA8] shrink-0 mt-0.5" />]] as const).map(([titulo, lista, icone]) =>
              lista.length > 0 && (
                <div key={titulo}>
                  <p className="text-[9px] uppercase tracking-wider text-[#7A8FA8] mb-0.5">{titulo}</p>
                  <ul className="space-y-0.5">{lista.map((t, i) => <li key={i} className="flex items-start gap-1.5 text-[11px] text-[#F0ECE4]">{icone}<span>{t}</span></li>)}</ul>
                </div>
              ))}
          </div>
          <div className="grid sm:grid-cols-2 gap-2">
            <Bloco titulo="Identificação">
              <Linha rotulo="Matrícula" valor={`${txt(av.identificacao.matricula)}${av.identificacao.cartorio ? ` · ${av.identificacao.cartorio}` : ""}`} />
              <Linha rotulo="Certidão" valor={<>{data(av.identificacao.data_certidao)}{diasMatricula !== null && <span className={diasMatricula > 30 ? " text-red-300" : " text-[#7A8FA8]"}> ({diasMatricula} dias)</span>}</>} />
              <Linha rotulo="Proprietário(s)" valor={(av.identificacao.proprietarios ?? []).join(", ") || "—"} />
              {av.identificacao.denominacao && <Linha rotulo="Denominação" valor={av.identificacao.denominacao} />}
              <Linha rotulo="Localização" valor={[av.identificacao.endereco, av.identificacao.bairro, [av.identificacao.cidade, av.identificacao.uf].filter(Boolean).join("/")].filter(Boolean).join(" · ") || "—"} />
            </Bloco>
            <Bloco titulo="Rating da Garantia V3">
              {av.rating.fatores.map((f) => (
                <div key={f.categoria} className="py-0.5">
                  <div className="flex justify-between text-[10px]"><span className="text-[#7A8FA8]">{f.categoria}</span><span className="text-[#F0ECE4]">{f.pontos}/{f.max}</span></div>
                  <div className="h-1 rounded-full bg-[#243A66]/60 mt-0.5"><div className="h-1 rounded-full bg-gradient-to-r from-[#C9A84C] to-[#E8C97A]" style={{ width: `${(f.pontos / f.max) * 100}%` }} /></div>
                </div>
              ))}
            </Bloco>
          </div>
          {av.documentos_faltantes.length > 0 && (
            <p className="text-[10px] text-[#7A8FA8]">Faltam: <span className="text-[#E8C97A]">{av.documentos_faltantes.join(" · ")}</span></p>
          )}
          {v.valor_mercado !== null && (
            <button onClick={() => onUsarValor(v.valor_mercado!)} className="w-full h-8 rounded-md border border-[#C9A84C]/40 text-[#E8C97A] text-[11px] font-semibold hover:bg-[#C9A84C]/10 transition-colors">
              Usar {formatCurrency(v.valor_mercado)} como Valor Médio de Avaliação
            </button>
          )}
        </div>
      )}

      {aba === "registro" && (
        <div className="space-y-2">
          <Bloco titulo="Ônus e gravames">
            {av.registro.onus.length === 0 ? <p className="text-[11px] text-[#7A8FA8]">Nenhum ônus encontrado na matrícula.</p> : av.registro.onus.map((o, i) => (
              <div key={i} className="flex items-start justify-between gap-2 py-1 border-b border-[#243A66]/40 last:border-0">
                <div>
                  <p className="text-[11px] text-[#F0ECE4] font-semibold">{o.tipo}{o.registro ? ` · ${o.registro}` : ""}</p>
                  <p className="text-[10px] text-[#7A8FA8]">{[o.favorecido ? `Favorecido: ${o.favorecido}` : null, o.descricao].filter(Boolean).join(" · ")}</p>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase shrink-0 ${o.ativo ? "bg-red-500/15 text-red-300" : "bg-[#243A66]/60 text-[#7A8FA8]"}`}>{o.ativo ? "Ativo" : "Cancelado"}</span>
              </div>
            ))}
          </Bloco>
          <Bloco titulo="Situação registral">
            <Linha rotulo="Construção averbada" valor={txt(av.registro.construcao_averbada)} />
            <Linha rotulo="Cadeia dominial" valor={txt(av.registro.cadeia_dominial)} />
            {av.identificacao.inscricao_municipal && <Linha rotulo="Inscrição municipal" valor={av.identificacao.inscricao_municipal} />}
            {av.identificacao.lote_quadra && <Linha rotulo="Lote / quadra" valor={av.identificacao.lote_quadra} />}
            {av.registro.observacoes && <p className="text-[10px] text-[#7A8FA8] pt-1">{av.registro.observacoes}</p>}
          </Bloco>
        </div>
      )}

      {aba === "areas" && (
        <Bloco titulo={ehRural ? "Quadro de áreas (ha)" : "Quadro de áreas (m²)"}>
          {ehRural ? (
            <>
              {([["Matrícula", av.areas.matricula_ha], ["CCIR", av.areas.ccir_ha], ["ITR", av.areas.itr_ha], ["CAR", av.areas.car_ha], ["GEO (memorial)", av.areas.geo_declarada_ha], ["GEO (calculada pela V3)", av.areas.geo_calculada_ha]] as const).map(([rot, val]) => {
                const base = av.areas.matricula_ha;
                const dif = base && val && rot !== "Matrícula" ? ((val - base) / base) * 100 : null;
                return <Linha key={rot} rotulo={rot} valor={<>{val ? `${n(val, 4)} ha` : "—"}{dif !== null && <span className={Math.abs(dif) > 5 ? " text-red-300" : " text-[#7A8FA8]"}> ({dif > 0 ? "+" : ""}{n(dif, 1)}%)</span>}</>} destaque={rot === "Matrícula"} />;
              })}
            </>
          ) : (
            <>
              {av.areas.privativa_m2 ? <Linha rotulo="Privativa (unidade)" valor={`${n(av.areas.privativa_m2)} m²`} /> : null}
              <Linha rotulo="Terreno (matrícula)" valor={av.areas.terreno_matricula_m2 ? `${n(av.areas.terreno_matricula_m2)} m²` : "—"} />
              <Linha rotulo="Terreno (IPTU)" valor={av.areas.terreno_iptu_m2 ? `${n(av.areas.terreno_iptu_m2)} m²` : "—"} />
              <Linha rotulo="Construída averbada" valor={av.areas.construida_matricula_m2 ? `${n(av.areas.construida_matricula_m2)} m²` : "—"} />
              <Linha rotulo="Construída (IPTU)" valor={av.areas.construida_iptu_m2 ? `${n(av.areas.construida_iptu_m2)} m²` : "—"} />
              <Linha rotulo="Construída real/estimada" valor={av.areas.construida_estimada_m2 ? `${n(av.areas.construida_estimada_m2)} m²` : "—"} />
            </>
          )}
          <Linha rotulo="Considerada no cálculo" valor={v.area_considerada ? `${n(v.area_considerada, v.unidade === "ha" ? 4 : 2)} ${un} · ${v.area_criterio}` : "—"} destaque />
        </Bloco>
      )}

      {aba === "caracteristicas" && !ehRural && av.urbano && (
        <div className="grid sm:grid-cols-2 gap-2">
          <Bloco titulo="Construção">
            <Linha rotulo="Tipo" valor={txt(av.urbano.tipo)} />
            <Linha rotulo="Padrão" valor={txt(av.urbano.padrao_descricao ?? av.urbano.padrao)} destaque />
            <Linha rotulo="Idade aparente" valor={av.urbano.idade_aparente_anos ? `${av.urbano.idade_aparente_anos} anos` : "—"} />
            <Linha rotulo="Conservação" valor={txt(av.urbano.conservacao)} />
            <Linha rotulo="Pavimentos" valor={txt(av.urbano.pavimentos)} />
            <Linha rotulo="Dorm. / suítes / vagas" valor={`${txt(av.urbano.dormitorios)} / ${txt(av.urbano.suites)} / ${txt(av.urbano.vagas)}`} />
            <Linha rotulo="Estrutura" valor={txt(av.urbano.estrutura)} />
            <Linha rotulo="Cobertura" valor={txt(av.urbano.cobertura)} />
            <Linha rotulo="Esquadrias" valor={txt(av.urbano.esquadrias)} />
          </Bloco>
          <Bloco titulo="Terreno e entorno">
            <Linha rotulo="Situação" valor={txt(av.urbano.situacao)} />
            <Linha rotulo="Topografia / formato" valor={`${txt(av.urbano.topografia)} / ${txt(av.urbano.formato_terreno)}`} />
            <Linha rotulo="Testada" valor={av.urbano.testada_m ? `${n(av.urbano.testada_m)} m` : "—"} />
            <Linha rotulo="Zoneamento" valor={txt(av.urbano.zoneamento)} />
            <Linha rotulo="Ocupação" valor={txt(av.urbano.ocupacao)} />
            <Linha rotulo="Infraestrutura" valor={<Chips itens={av.urbano.infraestrutura} />} />
            <Linha rotulo="Serviços próximos" valor={<Chips itens={av.urbano.servicos_proximos} />} />
            <Linha rotulo="Vizinhança" valor={txt(av.urbano.vizinhanca)} />
          </Bloco>
          {(av.urbano.acabamentos ?? []).length > 0 && (
            <Bloco titulo="Acabamentos por ambiente">
              {(av.urbano.acabamentos ?? []).map((a, i) => <Linha key={i} rotulo={a.ambiente} valor={a.descricao} />)}
            </Bloco>
          )}
          <Bloco titulo="IPTU">
            <Linha rotulo="Exercício" valor={txt(av.urbano.iptu?.exercicio)} />
            <Linha rotulo="Venal terreno" valor={av.urbano.iptu?.valor_venal_terreno ? formatCurrency(av.urbano.iptu.valor_venal_terreno) : "—"} />
            <Linha rotulo="Venal construção" valor={av.urbano.iptu?.valor_venal_construcao ? formatCurrency(av.urbano.iptu.valor_venal_construcao) : "—"} />
            <Linha rotulo="Venal total" valor={av.urbano.iptu?.valor_venal_total ? formatCurrency(av.urbano.iptu.valor_venal_total) : "—"} destaque />
            <Linha rotulo="IPTU anual" valor={av.urbano.iptu?.valor_iptu_anual ? formatCurrency(av.urbano.iptu.valor_iptu_anual) : "—"} />
            <Linha rotulo="Débitos" valor={txt(av.urbano.iptu?.debitos)} />
            <Linha rotulo="Lazer / compartimentos" valor={<Chips itens={[...(av.urbano.lazer ?? []), ...(av.urbano.compartimentos ?? [])]} />} />
          </Bloco>
          {av.ambiental && <Bloco titulo="Ambiental e riscos"><p className="text-[11px] text-[#F0ECE4]">{av.ambiental}</p><Linha rotulo="Riscos" valor={<Chips itens={av.urbano.riscos} />} /></Bloco>}
        </div>
      )}

      {aba === "caracteristicas" && ehRural && av.rural && (
        <div className="grid sm:grid-cols-2 gap-2">
          <Bloco titulo="CCIR / INCRA">
            <Linha rotulo="Código INCRA" valor={txt(av.rural.codigo_incra)} />
            <Linha rotulo="CCIR" valor={`${txt(av.rural.ccir?.numero)}${av.rural.ccir?.exercicio ? ` · ${av.rural.ccir.exercicio}` : ""}`} />
            <Linha rotulo="Situação" valor={txt(av.rural.ccir?.situacao)} />
            <Linha rotulo="Módulos fiscais" valor={`${txt(av.rural.ccir?.modulos_fiscais)}${av.rural.modulo_fiscal_ha ? ` (módulo de ${av.rural.modulo_fiscal_ha} ha)` : ""}`} />
            <Linha rotulo="Classificação" valor={txt(av.rural.ccir?.classificacao ?? av.rural.porte)} />
          </Bloco>
          <Bloco titulo="ITR / Receita Federal">
            <Linha rotulo="NIRF / CIB" valor={txt(av.rural.itr?.nirf)} />
            <Linha rotulo="Exercício" valor={txt(av.rural.itr?.exercicio)} />
            <Linha rotulo="VTN declarado" valor={av.rural.itr?.vtn_declarado ? formatCurrency(av.rural.itr.vtn_declarado) : "—"} />
            <Linha rotulo="Situação" valor={txt(av.rural.itr?.situacao)} />
          </Bloco>
          <Bloco titulo="CAR e ambiental">
            <Linha rotulo="Código CAR" valor={<span className="break-all">{txt(av.rural.car?.codigo)}</span>} />
            <Linha rotulo="Situação" valor={txt(av.rural.car?.situacao)} />
            <Linha rotulo="Reserva Legal" valor={`${av.rural.car?.reserva_legal_ha ? `${n(av.rural.car.reserva_legal_ha, 4)} ha` : "—"} · exigida ${av.rural.reserva_legal_exigida_pct ?? "—"}%`} />
            <Linha rotulo="APP" valor={av.rural.car?.app_ha ? `${n(av.rural.car.app_ha, 4)} ha` : "—"} />
            <Linha rotulo="Vegetação nativa" valor={av.rural.car?.vegetacao_nativa_ha ? `${n(av.rural.car.vegetacao_nativa_ha, 4)} ha` : "—"} />
            <Linha rotulo="Bioma" valor={txt(av.rural.bioma)} />
            {av.ambiental && <p className="text-[10px] text-[#7A8FA8] pt-1">{av.ambiental}</p>}
          </Bloco>
          <Bloco titulo="Campo">
            <Linha rotulo="Aptidão" valor={txt(av.rural.aptidao)} />
            <Linha rotulo="Uso do solo" valor={<Chips itens={av.rural.uso_solo} />} />
            <Linha rotulo="Recursos hídricos" valor={<Chips itens={av.rural.recursos_hidricos} />} />
            <Linha rotulo="Cercas" valor={txt(av.rural.cercas)} />
            <Linha rotulo="Acesso" valor={txt(av.rural.acesso)} />
            <Linha rotulo="Servidão de passagem" valor={txt(av.rural.servidao_passagem)} />
          </Bloco>
          {(av.rural.edificacoes ?? []).length > 0 && (
            <div className="sm:col-span-2">
              <Bloco titulo="Edificações e benfeitorias">
                {(av.rural.edificacoes ?? []).map((e, i) => (
                  <Linha key={i} rotulo={e.nome} valor={<>{e.area_m2 ? `${n(e.area_m2, 0)} m²` : "—"} · {e.idade_aparente_anos ? `${e.idade_aparente_anos} anos` : "idade —"} · {txt(e.conservacao)} · <span className={e.averbada === false ? "text-[#E8C97A]" : "text-[#7A8FA8]"}>{e.averbada === false ? "não averbada" : e.averbada ? "averbada" : "averbação —"}</span></>} />
                ))}
              </Bloco>
            </div>
          )}
        </div>
      )}

      {aba === "geo" && (
        <div className="space-y-2">
          {ehRural && av.poligonal ? (
            <div className="grid sm:grid-cols-[1.3fr_1fr] gap-2">
              <DesenhoPoligonal p={av.poligonal} />
              <Bloco titulo="Georreferenciamento">
                <Linha rotulo="Certificação SIGEF" valor={av.rural?.geo?.certificado ? `Sim${av.rural.geo.data_certificacao ? ` · ${data(av.rural.geo.data_certificacao)}` : ""}` : av.rural?.geo?.certificado === false ? "Não" : "—"} />
                <Linha rotulo="Averbado na matrícula" valor={av.rural?.geo?.averbado_na_matricula ? "Sim" : av.rural?.geo?.averbado_na_matricula === false ? "Não" : "—"} />
                <Linha rotulo="Código da parcela" valor={<span className="break-all">{txt(av.rural?.geo?.codigo_parcela)}</span>} />
                <Linha rotulo="Vértices lidos" valor={`${av.poligonal.vertices.length}`} />
                <Linha rotulo="Área calculada" valor={`${n(av.poligonal.area_ha, 4)} ha`} destaque />
                <Linha rotulo="Perímetro calculado" valor={`${n(av.poligonal.perimetro_m, 0)} m${av.rural?.geo?.perimetro_m ? ` (memorial ${n(av.rural.geo.perimetro_m, 0)} m)` : ""}`} />
                <Linha rotulo="Centro da área" valor={`${n(av.poligonal.centroide.lat, 6)}, ${n(av.poligonal.centroide.lon, 6)}`} />
                <Linha rotulo="Município do centro" valor={`${txt(av.poligonal.municipio_centroide)}${av.poligonal.uf_centroide ? `/${av.poligonal.uf_centroide}` : ""}`} />
                <Linha rotulo="Responsável técnico" valor={txt(av.rural?.geo?.responsavel_tecnico)} />
                <div className="flex gap-1.5 pt-1.5">
                  {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex-1 h-7 rounded-md border border-[#C9A84C]/40 text-[#E8C97A] text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-[#C9A84C]/10"><MapPin className="w-3 h-3" /> Ver no mapa</a>}
                  <button onClick={() => baixarKml(av.poligonal!)} className="flex-1 h-7 rounded-md border border-[#C9A84C]/40 text-[#E8C97A] text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-[#C9A84C]/10"><Download className="w-3 h-3" /> KML (Google Earth)</button>
                </div>
                <p className="text-[9px] text-[#7A8FA8] pt-1">Fonte: {av.poligonal.fonte}</p>
              </Bloco>
            </div>
          ) : ehRural ? (
            <p className="text-[11px] text-[#7A8FA8] italic">Sem coordenadas de vértices nos documentos. Anexe o memorial descritivo SIGEF (com a tabela de vértices) ou o arquivo KML da área.</p>
          ) : null}
          {!ehRural && (
            <Bloco titulo="Localização">
              <Linha rotulo="Endereço" valor={[av.identificacao.endereco, av.identificacao.bairro, [av.identificacao.cidade, av.identificacao.uf].filter(Boolean).join("/"), av.identificacao.cep ? `CEP ${av.identificacao.cep}` : null].filter(Boolean).join(" · ") || "—"} />
              <Linha rotulo="Coordenadas" valor={av.localizacao ? `${n(av.localizacao.lat, 6)}, ${n(av.localizacao.lon, 6)} (${av.localizacao.fonte})` : "—"} />
              {mapsUrl && <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 h-7 rounded-md border border-[#C9A84C]/40 text-[#E8C97A] text-[10px] font-semibold flex items-center justify-center gap-1 hover:bg-[#C9A84C]/10"><MapPin className="w-3 h-3" /> Ver no mapa (satélite)</a>}
            </Bloco>
          )}
          {av.mercado?.resumo_regiao && <Bloco titulo="Região (internet)"><p className="text-[11px] text-[#F0ECE4] leading-relaxed">{av.mercado.resumo_regiao}</p></Bloco>}
        </div>
      )}

      {aba === "mercado" && (
        <div className="space-y-2">
          {av.mercado && av.mercado.comparaveis.length > 0 ? (
            <>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {([["Menor", v.preco_unitario_min], ["Média saneada", v.preco_unitario_medio], ["Maior", v.preco_unitario_max]] as const).map(([rot, val]) => (
                  <div key={rot} className="rounded-md border border-[#243A66]/70 px-1.5 py-1.5">
                    <p className="text-[8px] uppercase tracking-wider text-[#7A8FA8]">{rot} R$/{un}</p>
                    <p className="text-[11px] font-semibold text-[#F0ECE4]">{val ? formatCurrency(val) : "—"}</p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-[#7A8FA8]">
                Anúncios × fator de oferta {n(v.fator_oferta)} · saneamento ±30% da média ({v.amostra_saneada} de {v.amostra_total} aceitos) · aplicado: {v.criterio} · confiança {av.mercado.confianca.toLowerCase()}
              </p>
              <div className="space-y-1">
                {av.mercado.comparaveis.map((c, i) => {
                  const ok = v.saneados[i] ?? true;
                  return (
                    <div key={i} className={`rounded-md border px-2 py-1.5 ${ok ? "border-[#243A66]/70" : "border-[#243A66]/30 opacity-50"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[11px] text-[#F0ECE4] ${ok ? "" : "line-through"}`}>{c.titulo}</p>
                        <span className="text-[10px] font-semibold text-[#E8C97A] shrink-0">{formatCurrency(c.preco_unitario)}/{un}</span>
                      </div>
                      <p className="text-[10px] text-[#7A8FA8]">
                        {formatCurrency(c.valor)} · {n(c.area, v.unidade === "ha" ? 2 : 0)} {un}{c.observacao ? ` · ${c.observacao}` : ""}{!ok ? " · descartado no saneamento" : ""}
                      </p>
                      {c.fonte_url && <a href={c.fonte_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#C9A84C] hover:underline inline-flex items-center gap-0.5">{c.fonte_nome ?? "anúncio"} <ExternalLink className="w-2.5 h-2.5" /></a>}
                    </div>
                  );
                })}
              </div>
              {av.mercado.observacoes && <p className="text-[10px] text-[#7A8FA8] italic">{av.mercado.observacoes}</p>}
            </>
          ) : <p className="text-[11px] text-[#7A8FA8] italic">Nenhum comparável encontrado na internet para a região.</p>}
          {av.laudo_externo && (
            <Bloco titulo="Laudo anexado">
              <Linha rotulo="Empresa / nº" valor={`${txt(av.laudo_externo.empresa)} · ${txt(av.laudo_externo.numero)}`} />
              <Linha rotulo="Data-base" valor={data(av.laudo_externo.data_base)} />
              <Linha rotulo="Mercado / garantia" valor={`${av.laudo_externo.valor_mercado ? formatCurrency(av.laudo_externo.valor_mercado) : "—"} / ${av.laudo_externo.valor_garantia ? formatCurrency(av.laudo_externo.valor_garantia) : "—"}`} destaque />
              <Linha rotulo="Fundamentação / precisão" valor={`${txt(av.laudo_externo.grau_fundamentacao)} / ${txt(av.laudo_externo.grau_precisao)}`} />
              {av.laudo_externo.parecer && <p className="text-[10px] text-[#7A8FA8] pt-1">{av.laudo_externo.parecer}</p>}
            </Bloco>
          )}
        </div>
      )}

      {aba === "documentos" && (
        <div className="space-y-1">
          {av.arquivos.map((a, i) => (
            <div key={i} className="flex items-start gap-2 rounded-md border border-[#243A66]/60 px-2 py-1.5">
              <FileText className="w-3.5 h-3.5 text-[#C9A84C] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] text-[#F0ECE4]"><span className="font-semibold text-[#E8C97A]">{TIPO_DOC_LABEL[a.tipo] ?? a.tipo}</span> · <span className="break-all">{a.file_name}</span></p>
                {a.resumo && <p className="text-[10px] text-[#7A8FA8]">{a.resumo}</p>}
              </div>
            </div>
          ))}
          {(job?.ignorados ?? []).length > 0 && (
            <p className="text-[10px] text-[#7A8FA8] pt-1">Não lidos (limite de tamanho/quantidade): {job!.ignorados!.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}
