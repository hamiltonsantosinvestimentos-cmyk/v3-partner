"use client";

import React, { useState } from "react";
import { Download, FileText, FileSpreadsheet, Loader2, ChevronDown } from "lucide-react";
import { exportPDF, exportExcel, type ExportOptions } from "@/lib/export-utils";

interface Props {
  opts: ExportOptions;
  className?: string;
}

export function ExportButton({ opts, className = "" }: Props) {
  const [loading, setLoading] = useState<"pdf" | "excel" | null>(null);
  const [open, setOpen] = useState(false);

  const run = async (tipo: "pdf" | "excel") => {
    setLoading(tipo);
    setOpen(false);
    try {
      if (tipo === "pdf") await exportPDF(opts);
      else await exportExcel(opts);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/50 hover:border-border transition-all"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        Exportar
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-40 bg-[#091221] border border-[#122036] rounded-xl shadow-2xl overflow-hidden min-w-[170px]">
            <div className="px-3 py-2 border-b border-[#122036]">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Formato</p>
            </div>
            <button
              onClick={() => run("pdf")}
              disabled={!!loading}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-white hover:bg-[#0F1E35] transition-colors"
            >
              <FileText className="w-3.5 h-3.5 text-red-400" />
              <div className="text-left">
                <div className="font-semibold">PDF</div>
                <div className="text-[10px] text-muted-foreground">Com logo V3 Partners</div>
              </div>
            </button>
            <button
              onClick={() => run("excel")}
              disabled={!!loading}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-xs text-white hover:bg-[#0F1E35] transition-colors border-t border-[#122036]/50"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <div className="text-left">
                <div className="font-semibold">Excel (.xlsx)</div>
                <div className="text-[10px] text-muted-foreground">Planilha editável</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
