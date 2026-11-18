"use client";

import { useState } from "react";
import { X, ZoomIn, ZoomOut, ExternalLink } from "lucide-react";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_PASSO, limitarZoom } from "@/lib/zoom-imagem";

// Visualizador de imagem de documento com zoom (conferência de qualificação). Fecha só pelos botões:
// clicar no fundo não fecha, para não perder a conferência em andamento.
export function ImageZoomViewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(ZOOM_MIN);
  const btn = "flex items-center gap-1 text-[12px] font-bold text-[#F5F1E8] bg-[#12112A] border border-[#C9A84C]/30 hover:border-[#C9A84C] rounded px-3 py-1.5";
  return (
    <div className="fixed inset-0 z-[130] flex flex-col bg-black/90">
      <div className="flex items-center gap-2 p-3 border-b border-[#C9A84C]/20 flex-shrink-0">
        <button type="button" className={btn} onClick={() => setZoom((z) => limitarZoom(z - ZOOM_PASSO))} disabled={zoom <= ZOOM_MIN} aria-label="Diminuir zoom"><ZoomOut size={14} /> Menos</button>
        <span className="text-[12px] text-[#E8C97A] font-bold w-12 text-center">{Math.round(zoom * 100)}%</span>
        <button type="button" className={btn} onClick={() => setZoom((z) => limitarZoom(z + ZOOM_PASSO))} disabled={zoom >= ZOOM_MAX} aria-label="Aumentar zoom"><ZoomIn size={14} /> Mais</button>
        <button type="button" className={btn} onClick={() => setZoom(ZOOM_MIN)}>Ajustar</button>
        <button type="button" className={btn} onClick={() => window.open(url, "_blank")}><ExternalLink size={14} /> Janela separada</button>
        <button type="button" onClick={onClose} className="ml-auto text-[#F5F1E8] hover:text-[#C9A84C]" aria-label="Fechar"><X size={22} /></button>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="Documento" style={{ width: `${zoom * 100}%`, maxWidth: "none" }} className="block mx-auto h-auto" />
      </div>
    </div>
  );
}
