"use client";

import { X, Download, Award, CheckCircle2 } from "lucide-react";

interface CertificateProps {
  partnerName: string;
  categoryLabel: string;
  categoryIcon: string;
  issuedAt: string;
  onClose: () => void;
}

export function AcademyCertificate({ partnerName, categoryLabel, categoryIcon, issuedAt, onClose }: CertificateProps) {
  const dateStr = new Date(issuedAt).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 print:p-0">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm print:hidden" onClick={onClose} />

      {/* Certificate card */}
      <div className="relative w-full max-w-2xl print:max-w-none print:w-full" id="certificate">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 w-9 h-9 rounded-full bg-[#243A66] flex items-center justify-center text-[#7A8FA8] hover:text-[#F0ECE4] transition-colors z-10 print:hidden"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Certificate body */}
        <div
          className="rounded-2xl overflow-hidden shadow-2xl print:rounded-none print:shadow-none"
          style={{ background: "linear-gradient(135deg, #0D1929 0%, #111F35 50%, #0A1221 100%)" }}
        >
          {/* Gold top border */}
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #C9A84C, #E8C97A, #C9A84C)" }} />

          <div className="px-12 py-10 print:px-16 print:py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#C9A84C]/20 border border-[#C9A84C]/30 flex items-center justify-center">
                  <Award className="w-5 h-5 text-[#C9A84C]" />
                </div>
                <div>
                  <p className="text-xs font-black text-[#C9A84C] tracking-[0.2em] uppercase">V3 Partners</p>
                  <p className="text-[10px] text-[#7A8FA8] tracking-wide">Academy</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-[#7A8FA8]">Emitido em</p>
                <p className="text-xs font-semibold text-[#F0ECE4]">{dateStr}</p>
              </div>
            </div>

            {/* Main content */}
            <div className="text-center py-6">
              {/* Category icon */}
              <div className="text-5xl mb-4">{categoryIcon}</div>

              <p className="text-xs font-black text-[#C9A84C] tracking-[0.25em] uppercase mb-3">
                Certificado de Conclusão
              </p>

              <p className="text-sm text-[#7A8FA8] mb-2">Este certificado é concedido a</p>

              <h2 className="text-3xl font-bold mb-2" style={{ color: "#F0ECE4" }}>
                {partnerName}
              </h2>

              <p className="text-sm text-[#7A8FA8] mb-1">pela conclusão da trilha</p>

              <h3 className="text-xl font-bold text-[#C9A84C] mb-6">
                {categoryLabel}
              </h3>

              {/* Divider ornament */}
              <div className="flex items-center gap-3 justify-center mb-6">
                <div className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(90deg, transparent, #C9A84C)" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[#C9A84C]" />
                <div className="h-px flex-1 max-w-[80px]" style={{ background: "linear-gradient(90deg, #C9A84C, transparent)" }} />
              </div>

              <p className="text-xs text-[#7A8FA8] max-w-sm mx-auto leading-relaxed">
                Reconhecemos a dedicação e comprometimento com o desenvolvimento profissional
                no ecossistema V3 Partners.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-[#243A66]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-emerald-400 font-semibold">Certificado Verificado</span>
              </div>
              <p className="text-[10px] text-[#7A8FA8]">v3partners.com.br</p>
            </div>
          </div>

          {/* Gold bottom border */}
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #C9A84C, #E8C97A, #C9A84C)" }} />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4 justify-center print:hidden">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C9A84C] text-[#09081A] text-sm font-bold hover:bg-[#E8C97A] transition-colors"
          >
            <Download className="w-4 h-4" />
            Salvar / Imprimir
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#243A66] text-[#7A8FA8] text-sm hover:text-[#F0ECE4] hover:border-[#7A8FA8] transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #certificate, #certificate * { visibility: visible; }
          #certificate { position: fixed; inset: 0; }
        }
      `}</style>
    </div>
  );
}
