"use client";

const STATUS_STEPS = [
  { key: "PENDENTE",               label: "Você assinou",        done: (c: ContratoData) => !!c.signed_at },
  { key: "AGUARDANDO_V3",          label: "V3 Partners assinou", done: (c: ContratoData) => !!c.v3_signed_at },
  { key: "AGUARDANDO_TESTEMUNHA",  label: "Parceiro assinou",    done: (c: ContratoData) => !!c.testemunha_signed_at },
  { key: "AGUARDANDO_TESTEMUNHA2", label: "Testemunha assinou",  done: (c: ContratoData) => !!c.testemunha2_signed_at },
];

interface ContratoData {
  id: string;
  status: string;
  client_name: string;
  client_email: string;
  credit_line: string | null;
  deal_value: number | null;
  commission_perc: number;
  proposal_code: string | null;
  created_at: string;
  expires_at: string;
  signed_at: string | null;
  v3_signed_at: string | null;
  v3_signer_name: string | null;
  testemunha_nome: string | null;
  testemunha_signed_at: string | null;
  testemunha2_nome: string | null;
  testemunha2_signed_at: string | null;
  contrato_url: string | null;
  contrato_pdf_url: string | null;
  client_doc_url: string | null;
}

const moeda = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null;

export function MeusContratosClient({ contrato }: { contrato: ContratoData }) {
  const finalizado = contrato.status === "ASSINADO";
  const cancelado  = contrato.status === "CANCELADO";
  const expirado   = contrato.status === "EXPIRADO";

  return (
    <div className="min-h-screen bg-[#09081A] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A84C] to-[#E8C97A] flex items-center justify-center">
            <span className="text-lg font-black text-[#09081A]">V3</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Meus Contratos</h1>
            <p className="text-[11px] text-[#7A8FA8]">V3 Partners · {contrato.proposal_code}</p>
          </div>
        </div>

        {/* Status geral */}
        {finalizado && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-2">
            <p className="text-3xl">✅</p>
            <p className="font-bold text-emerald-400 text-lg">Contrato Totalmente Assinado</p>
            <p className="text-[#7A8FA8] text-sm">
              Todas as partes assinaram. Baixe o certificado abaixo.
            </p>
          </div>
        )}
        {cancelado && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-center space-y-2">
            <p className="text-3xl">⛔</p>
            <p className="font-bold text-red-400 text-lg">Contrato Cancelado</p>
            <p className="text-[#7A8FA8] text-sm">Entre em contato com a equipe V3 Partners.</p>
          </div>
        )}
        {expirado && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-5 text-center space-y-2">
            <p className="text-3xl">⏰</p>
            <p className="font-bold text-amber-400 text-lg">Link Expirado</p>
            <p className="text-[#7A8FA8] text-sm">Solicite novo link à equipe V3 Partners.</p>
          </div>
        )}

        {/* Dados do contrato */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-5 space-y-3">
          <h2 className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Dados da Operação</h2>
          {[
            ["Cliente",          contrato.client_name],
            ["E-mail",           contrato.client_email],
            ["Linha de Crédito", contrato.credit_line ?? "—"],
            ["Valor estimado",   contrato.deal_value ? moeda(contrato.deal_value) : "—"],
            ["Comissão V3",      `${contrato.commission_perc}%`],
            ["Enviado em",       fmt(contrato.created_at) ?? "—"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between items-center border-b border-[#1B3050] pb-2 last:border-0">
              <span className="text-[11px] text-[#7A8FA8]">{label}</span>
              <span className="text-[12px] font-semibold text-white">{value}</span>
            </div>
          ))}
        </div>

        {/* Progresso de assinaturas */}
        <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-5 space-y-3">
          <h2 className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Progresso das Assinaturas</h2>
          <div className="space-y-3">
            {STATUS_STEPS.map((step, i) => {
              const done = step.done(contrato);
              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    done ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1B3050] text-[#7A8FA8]"
                  }`}>
                    {done ? "✓" : i + 1}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${done ? "text-white" : "text-[#7A8FA8]"}`}>
                      {step.label}
                    </p>
                    {done && (() => {
                      const dates = [
                        fmt(contrato.signed_at),
                        fmt(contrato.v3_signed_at),
                        fmt(contrato.testemunha_signed_at),
                        fmt(contrato.testemunha2_signed_at),
                      ];
                      return dates[i] ? (
                        <p className="text-[10px] text-[#7A8FA8]">{dates[i]}</p>
                      ) : null;
                    })()}
                  </div>
                  {done && <span className="text-emerald-400 text-xs">✅</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Downloads */}
        {finalizado && (contrato.contrato_url || contrato.contrato_pdf_url) && (
          <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Baixar Certificado</h2>
            <div className="flex flex-col gap-2">
              {contrato.contrato_pdf_url && (
                <a
                  href={contrato.contrato_pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 bg-[#C9A84C]/10 border border-[#C9A84C]/30 rounded-xl hover:bg-[#C9A84C]/20 transition-colors"
                >
                  <div>
                    <p className="text-sm font-bold text-[#C9A84C]">⬇ Certificado PDF</p>
                    <p className="text-[10px] text-[#7A8FA8]">Recomendado — aceito em cartórios e bancos</p>
                  </div>
                  <span className="text-[#C9A84C] text-xs">PDF</span>
                </a>
              )}
              {contrato.contrato_url && (
                <a
                  href={contrato.contrato_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between px-4 py-3 bg-[#1B3050]/40 border border-[#1B3050] rounded-xl hover:bg-[#1B3050]/60 transition-colors"
                >
                  <div>
                    <p className="text-sm font-semibold text-white">⬇ Certificado HTML</p>
                    <p className="text-[10px] text-[#7A8FA8]">Versão interativa completa</p>
                  </div>
                  <span className="text-[#7A8FA8] text-xs">HTML</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Documento enviado */}
        {contrato.client_doc_url && (
          <div className="bg-[#0C1929] border border-[#1B3050] rounded-2xl p-5 space-y-2">
            <h2 className="text-xs font-bold text-[#C9A84C] uppercase tracking-widest">Documento Enviado</h2>
            <a href={contrato.client_doc_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-[#C9A84C] underline hover:text-[#E8C97A]">
              Ver documento de identidade enviado
            </a>
          </div>
        )}

        <div className="text-center pb-6">
          <p className="text-[11px] text-[#7A8FA8]">
            V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50
          </p>
          <a href="mailto:contato@v3partners.com.br"
            className="text-[11px] text-[#C9A84C] hover:underline">
            contato@v3partners.com.br
          </a>
        </div>

      </div>
    </div>
  );
}
