"use client";
import { confirmar } from "@/lib/aviso";

import { useCallback, useEffect, useState } from "react";
import { FileSignature, Loader2, Upload, Mail, Download, CheckCircle2, Copy, Check, X } from "lucide-react";
import type { Arquivo, DocAssinatura } from "@/lib/documentos-assinatura";

type DocComArquivos = DocAssinatura & { arquivos?: Arquivo[] };

// Documentos para assinatura do cliente (aba Documentos do modal da proposta):
// Mesa sobe o arquivo → partner/Mesa envia por e-mail ao cliente (orientação + link para baixar e
// devolver assinado) → o assinado chega pelo link ou é subido aqui → "Confirmar envio" notifica a Mesa.

const STATUS: Record<string, { label: string; cor: string }> = {
  aguardando_envio: { label: "Aguardando envio ao cliente", cor: "bg-secondary text-muted-foreground" },
  enviado_cliente: { label: "Enviado ao cliente", cor: "bg-blue-500/10 text-blue-300" },
  assinado_recebido: { label: "Assinado recebido", cor: "bg-amber-500/10 text-amber-300" },
  confirmado: { label: "Confirmado", cor: "bg-emerald-500/10 text-emerald-400" },
};

const inp = "h-8 px-2.5 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");

function Item({ doc, emailPadrao, podeMesa, onAtualizado }: { doc: DocComArquivos; emailPadrao: string; podeMesa: boolean; onAtualizado: () => void }) {
  const [email, setEmail] = useState(doc.email_cliente ?? emailPadrao);
  const [busy, setBusy] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const link = typeof window !== "undefined" ? `${window.location.origin}/assinatura/${doc.token}` : "";
  const st = STATUS[doc.status] ?? STATUS.aguardando_envio;

  async function acao(nome: "enviar" | "confirmar" | "cancelar") {
    if (nome === "cancelar" && !await confirmar(`Cancelar "${doc.titulo}"? O link do cliente deixa de funcionar.`)) return;
    setBusy(nome); setErro(null); setMsg(null);
    const r = await fetch(`/api/credit-proposals/assinaturas/${doc.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: nome, email }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setErro(j.error ?? "Falha na operação."); return; }
    if (nome === "enviar") setMsg(`E-mail enviado para ${email}.`);
    if (nome === "confirmar") setMsg("Envio confirmado. A Mesa Operacional foi notificada.");
    onAtualizado();
  }

  async function subirAssinado(files: File[]) {
    if (files.length === 0) return;
    setBusy("assinado"); setErro(null); setMsg(null);
    const fd = new FormData();
    for (const f of files) fd.append("file", f);
    const r = await fetch(`/api/credit-proposals/assinaturas/${doc.id}`, { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { setErro(j.error ?? "Falha ao enviar."); return; }
    setMsg(`${files.length > 1 ? `${files.length} arquivos assinados recebidos` : "Arquivo assinado recebido"}. Agora clique em Confirmar envio.`);
    onAtualizado();
  }

  return (
    <div className="rounded-lg border border-border/50 bg-secondary/20 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{doc.titulo}</p>
          {doc.orientacao && <p className="text-[11px] text-muted-foreground whitespace-pre-line mt-0.5">{doc.orientacao}</p>}
        </div>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${st.cor}`}>{st.label}</span>
      </div>

      {(() => {
        const arqs = doc.arquivos ?? [{ nome: doc.original_nome, path: doc.original_path, tipo: "original" as const, em: null }];
        const originais = arqs.filter((x) => x.tipo === "original");
        const assinados = arqs.filter((x) => x.tipo === "assinado");
        const link = (x: Arquivo, cor: string) => (
          <a key={x.path} href={`/api/credit-proposals/assinaturas/${doc.id}?path=${encodeURIComponent(x.path)}`} target="_blank" rel="noreferrer"
            className={`inline-flex items-center gap-1 ${cor} hover:underline`}>
            <Download className="w-3 h-3" /> {x.nome}
          </a>
        );
        return (
          <div className="space-y-1 text-[11px]">
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="text-muted-foreground">Para assinar ({originais.length}):</span>
              {originais.map((x) => link(x, "text-[#C9A84C]"))}
            </div>
            {assinados.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <span className="text-muted-foreground">
                  Assinados ({assinados.length}) · último {doc.assinado_origem === "cliente" ? "pelo cliente" : "pela plataforma"} {fmt(doc.assinado_em)}:
                </span>
                {assinados.map((x) => link(x, "text-emerald-400"))}
              </div>
            )}
          </div>
        );
      })()}
      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-x-3">
        {doc.email_enviado_em && <span>E-mail enviado a {doc.email_cliente} em {fmt(doc.email_enviado_em)}</span>}
        {doc.cliente_baixou_em && <span>Cliente baixou em {fmt(doc.cliente_baixou_em)}</span>}
        {doc.confirmado_em && <span className="text-emerald-400">Confirmado em {fmt(doc.confirmado_em)}</span>}
      </div>

      {doc.status !== "confirmado" && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <input className={`${inp} flex-1 min-w-[180px]`} type="email" placeholder="E-mail do cliente" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button onClick={() => acao("enviar")} disabled={busy !== null || !email}
              className="h-8 px-3 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
              {busy === "enviar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              {doc.email_enviado_em ? "Reenviar ao cliente" : "Enviar ao cliente por e-mail"}
            </button>
            <button onClick={() => navigator.clipboard.writeText(link).then(() => { setCopiado(true); setTimeout(() => setCopiado(false), 1500); })}
              className="h-8 px-2.5 rounded-lg border border-border text-xs text-muted-foreground inline-flex items-center gap-1 hover:text-white" title="Copiar o link do cliente (para mandar por WhatsApp, por exemplo)">
              {copiado ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />} Link
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="h-8 px-3 rounded-lg border border-border text-xs inline-flex items-center gap-1.5 cursor-pointer hover:bg-secondary">
              {busy === "assinado" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {doc.assinado_path ? "Adicionar arquivos assinados" : "Subir arquivo(s) assinado(s)"}
              <input type="file" multiple className="hidden" accept="application/pdf,image/jpeg,image/png,.doc,.docx" disabled={busy !== null}
                onChange={(e) => { subirAssinado(Array.from(e.target.files ?? [])); e.target.value = ""; }} />
            </label>
            <button onClick={() => acao("confirmar")} disabled={busy !== null || !doc.assinado_path}
              title={doc.assinado_path ? "Confirma que o documento assinado foi enviado e avisa a Mesa Operacional" : "Aguardando o arquivo assinado (pelo cliente ou subido aqui)"}
              className="h-8 px-3 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-40">
              {busy === "confirmar" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Confirmar envio
            </button>
            {podeMesa && (
              <button onClick={() => acao("cancelar")} disabled={busy !== null} className="h-8 px-2 text-xs text-muted-foreground hover:text-red-400 inline-flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
          </div>
        </>
      )}
      {msg && <p className="text-[11px] text-emerald-400">{msg}</p>}
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}

export function DocumentosAssinatura({ proposalId }: { proposalId: string }) {
  const [docs, setDocs] = useState<DocComArquivos[] | null>(null);
  const [emailPadrao, setEmailPadrao] = useState("");
  const [podeMesa, setPodeMesa] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novo, setNovo] = useState<{ titulo: string; orientacao: string; files: File[] }>({ titulo: "", orientacao: "", files: [] });
  const [inputKey, setInputKey] = useState(0);
  const [subindo, setSubindo] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/credit-proposals/assinaturas?proposal_id=${proposalId}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setErro(j.error ?? "Falha ao carregar."); setDocs([]); return; }
    setDocs(j.documentos ?? []);
    setEmailPadrao(j.email_cliente_padrao ?? "");
    setPodeMesa(Boolean(j.pode_subir_original));
  }, [proposalId]);
  useEffect(() => { carregar(); }, [carregar]);

  async function subirOriginal() {
    if (novo.files.length === 0 || !novo.titulo.trim()) return;
    setSubindo(true); setErro(null);
    const fd = new FormData();
    fd.append("proposal_id", proposalId);
    fd.append("titulo", novo.titulo);
    fd.append("orientacao", novo.orientacao);
    for (const f of novo.files) fd.append("file", f);
    const r = await fetch("/api/credit-proposals/assinaturas", { method: "POST", body: fd });
    const j = await r.json().catch(() => ({}));
    setSubindo(false);
    if (!r.ok) { setErro(j.error ?? "Falha ao subir."); return; }
    setNovo({ titulo: "", orientacao: "", files: [] });
    setInputKey((k) => k + 1);
    carregar();
  }

  // Partner só vê a seção quando a Mesa já subiu algo.
  if (docs === null) return null;
  if (!podeMesa && docs.length === 0) return null;

  return (
    <div className="p-4 rounded-xl border border-[#C9A84C]/20 bg-[#12112A] space-y-3">
      <div>
        <p className="text-xs font-semibold text-[#C9A84C] flex items-center gap-1.5"><FileSignature className="w-3.5 h-3.5" /> Documentos para assinatura do cliente</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          A Mesa sobe o documento; o partner envia ao cliente por e-mail (com orientação e link para baixar e devolver assinado) ou sobe o assinado aqui. Depois, &quot;Confirmar envio&quot; avisa a Mesa Operacional.
        </p>
      </div>

      {podeMesa && (
        <div className="rounded-lg border border-dashed border-border/60 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-foreground">Novo documento para o cliente assinar <span className="font-normal text-muted-foreground">(pode escolher vários arquivos: vão juntos no mesmo e-mail)</span></p>
          <input className={`${inp} w-full`} placeholder="Nome do documento (ex.: Contrato de mandato, Ficha cadastral)" value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
          <textarea className="w-full min-h-[60px] px-2.5 py-2 text-xs bg-secondary border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-[#C9A84C]/50"
            placeholder="Orientação que vai no e-mail (opcional). Ex.: rubricar todas as páginas e assinar na última, igual ao documento de identidade."
            value={novo.orientacao} onChange={(e) => setNovo({ ...novo, orientacao: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2">
            <input key={inputKey} type="file" multiple accept="application/pdf,image/jpeg,image/png,.doc,.docx" className="text-xs text-muted-foreground"
              onChange={(e) => setNovo({ ...novo, files: Array.from(e.target.files ?? []) })} />
            {novo.files.length > 1 && <span className="text-[11px] text-muted-foreground">{novo.files.length} arquivos</span>}
            <button onClick={subirOriginal} disabled={subindo || novo.files.length === 0 || !novo.titulo.trim()}
              className="h-8 px-3 rounded-lg bg-[#C9A84C] text-[#09081A] text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-40">
              {subindo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir documento
            </button>
          </div>
        </div>
      )}

      {docs.map((d) => <Item key={d.id} doc={d} emailPadrao={emailPadrao} podeMesa={podeMesa} onAtualizado={carregar} />)}
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}
