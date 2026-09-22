"use client";

import { useState } from "react";
import { Loader2, FileDown, ExternalLink, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

// Botão "Gerar PDF unificado": um arquivo só com a capa-resumo, o dossiê da empresa e o de cada
// sócio/garantidor do pedido. Ver lib/credit-unified-pdf.ts.

interface Parte {
  papel: string;
  nome: string;
  tier: string | null;
  score: number | null;
  pagina_inicial: number;
  paginas: number;
}
interface Ausente { documento: string; papel: string; motivo: string }
interface Resultado {
  pdf_url: string | null;
  download_url: string | null;
  total_paginas: number;
  partes: Parte[];
  ausentes: Ausente[];
}

export function PdfUnificado({ orderId, temSocios }: { orderId: string; temSocios: boolean }) {
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [res, setRes] = useState<Resultado | null>(null);

  async function gerar() {
    setBusy(true);
    setErro(null);
    try {
      const r = await fetch(`/api/credit-engine/orders/${orderId}/unified-pdf`, { method: "POST" });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error ?? "Falha ao gerar o PDF unificado");
      setRes(json);
      if (json.pdf_url) window.open(json.pdf_url, "_blank", "noopener");
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">PDF unificado</p>
          <p className="text-xs text-foreground">
            {temSocios ? "Empresa + sócios/garantidores em um único arquivo, com capa-resumo." : "Dossiê com capa-resumo. Sócios adicionados ao pedido entram automaticamente."}
          </p>
        </div>
        <Button size="sm" disabled={busy} onClick={gerar} className="flex-shrink-0">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
          {busy ? "Gerando…" : "Gerar PDF"}
        </Button>
      </div>

      {busy && <p className="text-[11px] text-muted-foreground">Montando o arquivo. Pode levar até 1 minuto se algum dossiê precisar ser refeito.</p>}

      {res && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-2 space-y-1.5">
          <p className="text-[11px] text-emerald-300">PDF gerado: {res.partes.length} parte(s), {res.total_paginas} páginas.</p>
          <ul className="space-y-0.5">
            {res.partes.map((p, i) => (
              <li key={i} className="text-[11px] text-muted-foreground">
                <span className="text-foreground">{p.papel}: {p.nome}</span> — {p.tier ?? "—"} ({p.score ?? "—"} pts) · pág. {p.pagina_inicial}
              </li>
            ))}
          </ul>
          <div className="flex gap-3 pt-0.5">
            {res.pdf_url && (
              <a href={res.pdf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[11px] text-[#C9A84C] hover:underline">
                <ExternalLink className="w-3 h-3" /> Abrir
              </a>
            )}
            {res.download_url && (
              <a href={res.download_url} className="flex items-center gap-1 text-[11px] text-[#C9A84C] hover:underline">
                <FileDown className="w-3 h-3" /> Baixar
              </a>
            )}
          </div>
          {res.ausentes.length > 0 && (
            <p className="flex items-start gap-1 text-[11px] text-amber-300">
              <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-px" />
              Ficaram de fora: {res.ausentes.map((a) => `${a.papel} (${a.documento}) — ${a.motivo}`).join("; ")}.
            </p>
          )}
        </div>
      )}
      {erro && <p className="text-[11px] text-red-400">{erro}</p>}
    </div>
  );
}
