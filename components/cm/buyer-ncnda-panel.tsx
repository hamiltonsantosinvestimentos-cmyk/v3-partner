"use client";

import { useState } from "react";
import { Loader2, ShieldCheck, FileSignature, ExternalLink } from "lucide-react";
import type { DemandNcndaState, NcndaStage } from "@/lib/cm-ncnda";

// Bloco "NCNDA do Comprador" do card da demanda (Fase 5, 5.3, 20/09/2026).
// Fluxo da Etapa 3, na ordem que Joao definiu: qualificacao das partes, aprovacao da
// Mesa, assinatura do NCNDA. So depois disso o botao "Registrar NCNDA assinado" abre.
// Reaproveita a esteira que ja existia (lote de qualificacao com demand_id, minuta
// aprovada, /api/contracts/generate, ClickSign); este componente so amarra os passos.

const STAGE_LABEL: Record<NcndaStage, string> = {
  sem_lote: "Qualificação ainda não enviada",
  coletando: "Aguardando o comprador preencher a qualificação",
  pronto_para_contrato: "Qualificação completa, aguardando aprovação da Mesa",
  contrato_gerado: "NCNDA gerado, ainda não enviado para assinatura",
  enviado_assinatura: "NCNDA enviado, aguardando assinatura",
  assinado: "NCNDA assinado",
};

interface Props {
  demandId: string;
  /** Etapa atual da demanda: as acoes so ficam ativas em em_qualificacao. */
  demandStatus: string;
  defaultName: string;
  defaultEmail: string;
  state: DemandNcndaState | null;
  loading: boolean;
  onChanged: () => void;
}

export function BuyerNcndaPanel({ demandId, demandStatus, defaultName, defaultEmail, state, loading, onChanged }: Props) {
  const [name, setName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAct = demandStatus === "em_qualificacao";
  const stage = state?.stage ?? "sem_lote";

  const sendQualification = async () => {
    if (!state?.template) return;
    setBusy(true);
    setError(null);
    try {
      // document_type informado = lote formal (nao a indicacao rapida): nasce em "coletando",
      // com a minuta definida, e o comprador recebe o link de qualificacao por e-mail.
      const res = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          demand_id: demandId,
          template_id: state.template.id,
          document_type: "nda_quadripartite",
          parties: [{ full_name: name.trim(), email: email.trim(), role_in_document: "parte_principal" }],
        }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Erro ao enviar a qualificação.");
      else onChanged();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setBusy(false);
    }
  };

  const generateNcnda = async () => {
    if (!state?.template || !state.batch) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: state.template.id, qualification_batch_id: state.batch.id }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Erro ao gerar o NCNDA.");
      else onChanged();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E8C97A] mb-2.5">
        <FileSignature size={12} /> NCNDA do Comprador
      </div>
      <div className="bg-[#12112A] border border-[#243A66] rounded-lg p-3 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-3"><Loader2 size={14} className="text-[#9BAFC5] animate-spin" /></div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs">
              <ShieldCheck size={14} className={state?.signed ? "text-emerald-400" : "text-[#5A7490]"} />
              <span className={state?.signed ? "text-emerald-400 font-semibold" : "text-[#9BAFC5]"}>{STAGE_LABEL[stage]}</span>
            </div>

            {state?.batch && stage !== "assinado" && (
              <div className="text-[10px] text-[#9BAFC5]">
                Qualificação: {state.batch.parties_filled} de {state.batch.parties_total} preenchida(s)
                {state.batch.party_names.length > 0 ? ` (${state.batch.party_names.join(", ")})` : ""}
              </div>
            )}

            {state?.contract && (
              <div className="flex items-center gap-2 text-[10px] text-[#9BAFC5]">
                <span>Contrato {state.contract.contract_code ?? ""}</span>
                <a href="/juridico/contratos" className="flex items-center gap-1 text-[#E8C97A] underline">
                  Abrir na Central de Contratos <ExternalLink size={10} />
                </a>
              </div>
            )}

            {!state?.template && (
              <div className="text-[10px] text-[#E8935A]">
                Nenhuma minuta de NCNDA aprovada para Bolsa de Ativos. Verifique a Revisão Jurídica em Central de Contratos.
              </div>
            )}

            {canAct && state?.template && stage === "sem_lote" && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo do comprador"
                    className="bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/40 focus:outline-none"
                  />
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="E-mail"
                    className="bg-[#09081A] border border-[#9BAFC5]/15 rounded-lg px-3 py-2 text-xs text-[#F5F1E8] placeholder:text-[#9BAFC5]/40 focus:border-[#C9A84C]/40 focus:outline-none"
                  />
                </div>
                <button
                  onClick={sendQualification}
                  disabled={busy || !name.trim() || !email.trim()}
                  className="flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#E8C97A] px-3 py-1.5 text-[10px] font-bold hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {busy && <Loader2 size={11} className="animate-spin" />} Enviar qualificação ao comprador
                </button>
                <p className="text-[9px] text-[#9BAFC5]/60">Outras partes (intermediário, mandatário, testemunha) entram pelo painel de qualificação logo abaixo.</p>
              </div>
            )}

            {canAct && state?.template && stage === "pronto_para_contrato" && (
              <div className="space-y-2">
                <button
                  onClick={generateNcnda}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-lg border border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#E8C97A] px-3 py-1.5 text-[10px] font-bold hover:bg-[#C9A84C]/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {busy && <Loader2 size={11} className="animate-spin" />} Aprovar partes e gerar NCNDA
                </button>
                <p className="text-[9px] text-[#9BAFC5]/60">Confira os dados no painel de qualificação abaixo. Depois de gerado, o envio para assinatura é feito na Central de Contratos.</p>
              </div>
            )}

            {!canAct && stage === "sem_lote" && (
              <p className="text-[9px] text-[#9BAFC5]/60">O NCNDA é tratado na Etapa 3 (Qualificação).</p>
            )}

            {error && <div className="text-[10px] text-[#E8935A]">{error}</div>}
          </>
        )}
      </div>
    </div>
  );
}
