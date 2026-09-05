"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Shield,
  ExternalLink,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Loader2,
  FileSignature,
  Copy,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";

type DocType = "nda" | "mandato";
type SignStatus = "IDLE" | "PENDING" | "SIGNED" | "EXPIRED";

interface ContratoInfo {
  tipo: DocType;
  label: string;
  sublabel: string;
  description: string;
  icon: React.ReactNode;
}

const CONTRATOS: ContratoInfo[] = [
  {
    tipo: "nda",
    label: "NDA",
    sublabel: "Acordo de Confidencialidade",
    description:
      "Documento de não divulgação para proteger as informações do ativo durante o processo de avaliação. Validade de 24 meses, com foro no Rio de Janeiro.",
    icon: <Shield className="w-5 h-5" />,
  },
  {
    tipo: "mandato",
    label: "Mandato",
    sublabel: "Contrato de Intermediação",
    description:
      "Contrato de mandato exclusivo de M&A. Define honorários (success fee), período de exclusividade de 180 dias e atribuições da V3 Partners como assessora.",
    icon: <FileSignature className="w-5 h-5" />,
  },
];

const STATUS_CONFIG: Record<
  SignStatus,
  { label: string; badgeClass: string; icon: React.ReactNode }
> = {
  IDLE: {
    label: "Aguardando envio",
    badgeClass: "bg-[#243A66]/60 text-[#7A8FA8] border border-[#243A66]",
    icon: <Clock className="w-3 h-3" />,
  },
  PENDING: {
    label: "Aguardando assinatura do signatário",
    badgeClass: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    icon: <Clock className="w-3 h-3" />,
  },
  SIGNED: {
    label: "Assinado",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  EXPIRED: {
    label: "Expirado",
    badgeClass: "bg-red-500/20 text-red-400 border border-red-500/30",
    icon: <XCircle className="w-3 h-3" />,
  },
};

interface ContratoState {
  status: SignStatus;
  envelopeId: string | null;
  signUrl: string | null;
  sending: boolean;
  checking: boolean;
}

const INITIAL_STATE: ContratoState = {
  status: "IDLE",
  envelopeId: null,
  signUrl: null,
  sending: false,
  checking: false,
};

interface ContratoPanelProps {
  deal: {
    id: string;
    target_company: string;
    buyer_name?: string | null;
    seller_name?: string | null;
    asset_data?: {
      contato?: {
        nome?: string;
        email?: string;
        cargo?: string;
      };
    };
  };
  dealCode: string;
  isDemo?: boolean;
}

// 05/09/2026 (BRIEF NCNDA Mesa M&A): NDA deixa de passar por
// /api/ma/clicksign-send (sem governança, sem deal_id em operation_contracts,
// ver achado do BRIEF) e passa a usar a Central de Contratos: gera o
// contrato real (POST /api/contracts/generate, deal_id gravado) e a
// esteira de qualificação de partes já em produção (Bolsa de Ativos/
// Crédito). Mandato continua no fluxo antigo, fora de escopo desta troca.
interface NcndaQualification {
  id: string;
  full_name: string;
  email: string;
  status: string;
  qualification_token: string;
}
interface NcndaBatch {
  id: string;
  status: string;
  cm_party_qualifications?: NcndaQualification[];
}
interface NcndaContract {
  id: string;
  contract_code: string;
  status_signature: string;
}

export function ContratoPanel({ deal, dealCode, isDemo = false }: ContratoPanelProps) {
  const [selectedTipo, setSelectedTipo] = useState<DocType | null>(null);
  const [states, setStates] = useState<Record<DocType, ContratoState>>({
    nda: { ...INITIAL_STATE },
    mandato: { ...INITIAL_STATE },
  });

  const [ncndaTemplateId, setNcndaTemplateId] = useState<string | null | undefined>(undefined);
  const [ncndaContract, setNcndaContract] = useState<NcndaContract | null>(null);
  const [ncndaBatch, setNcndaBatch] = useState<NcndaBatch | null>(null);
  const [ncndaForm, setNcndaForm] = useState({
    full_name: deal.buyer_name || deal.seller_name || deal.asset_data?.contato?.nome || "",
    email: deal.asset_data?.contato?.email || "",
    phone: "",
  });
  const [ncndaSubmitting, setNcndaSubmitting] = useState(false);
  const [ncndaError, setNcndaError] = useState<string | null>(null);
  const [ncndaCopied, setNcndaCopied] = useState(false);

  useEffect(() => {
    async function loadNcndaState() {
      try {
        const tplRes = await fetch("/api/contracts/templates?vertical=ma");
        const tplData = await tplRes.json();
        const template = (tplData.templates ?? [])[0];
        setNcndaTemplateId(template?.id ?? null);

        const listRes = await fetch("/api/contracts/list?vertical=ma");
        const listData = await listRes.json();
        const existing = (listData.contracts ?? [])
          .filter((c: any) => c.deal_id === deal.id)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        if (!existing) return;
        setNcndaContract({ id: existing.id, contract_code: existing.contract_code, status_signature: existing.status_signature });

        const qRes = await fetch(`/api/cm/qualifications?operation_contract_id=${existing.id}`);
        const qData = await qRes.json();
        const batch = (qData.batches ?? [])[0];
        if (batch) setNcndaBatch(batch);
      } catch {
        // best-effort — painel cai no estado "sem contrato" (mostra o formulário)
      }
    }
    loadNcndaState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id]);

  async function handleSolicitarNcnda() {
    if (!ncndaTemplateId) {
      setNcndaError("Nenhum template de NCNDA aprovado para a Mesa M&A foi encontrado.");
      return;
    }
    if (!ncndaForm.full_name.trim() || !ncndaForm.email.trim()) {
      setNcndaError("Informe nome e e-mail da contraparte.");
      return;
    }
    setNcndaSubmitting(true);
    setNcndaError(null);
    try {
      const genRes = await fetch("/api/contracts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template_id: ncndaTemplateId, deal_id: deal.id }),
      });
      const genData = await genRes.json();
      if (!genRes.ok) {
        setNcndaError(genData.error ?? "Falha ao gerar o contrato.");
        return;
      }
      setNcndaContract({ id: genData.contract.id, contract_code: genData.contract.contract_code, status_signature: genData.contract.status_signature });

      const qualRes = await fetch("/api/cm/qualifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          operation_contract_id: genData.contract.id,
          document_type: "ncnda_ma",
          parties: [{ full_name: ncndaForm.full_name.trim(), email: ncndaForm.email.trim(), phone: ncndaForm.phone.trim() || undefined, role_in_document: "parte_principal" }],
        }),
      });
      const qualData = await qualRes.json();
      if (!qualRes.ok) {
        setNcndaError(qualData.error ?? "Contrato gerado, mas falha ao criar o link de qualificação.");
        return;
      }
      setNcndaBatch({ id: qualData.batch_id, status: "coletando", cm_party_qualifications: qualData.qualifications });
    } catch {
      setNcndaError("Falha de rede ao solicitar o NCNDA. Tente novamente.");
    } finally {
      setNcndaSubmitting(false);
    }
  }

  const ncndaQualificationLink = ncndaBatch?.cm_party_qualifications?.[0]?.qualification_token
    ? `https://app.v3partners.com.br/intake/qualificacao/${ncndaBatch.cm_party_qualifications[0].qualification_token}`
    : null;

  function ncndaStatusLabel(): { label: string; badgeClass: string; icon: React.ReactNode } {
    if (!ncndaContract) return STATUS_CONFIG.IDLE;
    if (ncndaContract.status_signature === "assinado") return STATUS_CONFIG.SIGNED;
    if (ncndaContract.status_signature === "cancelado") return STATUS_CONFIG.EXPIRED;
    if (ncndaContract.status_signature === "enviado") return { label: "Aguardando assinatura", badgeClass: STATUS_CONFIG.PENDING.badgeClass, icon: STATUS_CONFIG.PENDING.icon };
    if (!ncndaBatch || ncndaBatch.status !== "completo") return { label: "Aguardando qualificação da contraparte", badgeClass: STATUS_CONFIG.PENDING.badgeClass, icon: STATUS_CONFIG.PENDING.icon };
    return { label: "Qualificado, pronto para envio", badgeClass: STATUS_CONFIG.PENDING.badgeClass, icon: STATUS_CONFIG.PENDING.icon };
  }

  const selected = CONTRATOS.find((c) => c.tipo === selectedTipo);
  const currentState = selectedTipo ? states[selectedTipo] : null;

  function updateState(tipo: DocType, patch: Partial<ContratoState>) {
    setStates((prev) => ({
      ...prev,
      [tipo]: { ...prev[tipo], ...patch },
    }));
  }

  async function handleEnviar(tipo: DocType) {
    updateState(tipo, { sending: true });

    const contatoNome =
      deal.asset_data?.contato?.nome ?? "Representante Legal";
    const contatoEmail =
      deal.asset_data?.contato?.email ?? "contato@empresa.com.br";

    if (isDemo) {
      await new Promise((r) => setTimeout(r, 1000));
      const envelopeId = `DEMO-ENV-${Date.now()}`;
      updateState(tipo, {
        sending: false,
        status: "PENDING",
        envelopeId,
        signUrl: "https://app.clicksign.com/sign/demo",
      });
      return;
    }

    try {
      const res = await fetch("/api/ma/clicksign-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId: deal.id,
          documentType: tipo,
          signatories: [{ name: contatoNome, email: contatoEmail }],
        }),
      });
      const data = await res.json();
      if (data.ok) {
        updateState(tipo, {
          sending: false,
          status: "PENDING",
          envelopeId: data.envelopeId,
          signUrl: data.signUrl,
        });
      } else {
        updateState(tipo, { sending: false });
      }
    } catch {
      updateState(tipo, { sending: false });
    }
  }

  async function handleVerificarStatus(tipo: DocType) {
    const env = states[tipo].envelopeId;
    if (!env) return;
    updateState(tipo, { checking: true });

    try {
      const res = await fetch(`/api/ma/clicksign-status?envelopeId=${env}`);
      const data = await res.json();
      const apiStatus: SignStatus =
        data.status === "SIGNED"
          ? "SIGNED"
          : data.status === "EXPIRED"
            ? "EXPIRED"
            : "PENDING";
      updateState(tipo, { checking: false, status: apiStatus });
    } catch {
      updateState(tipo, { checking: false });
    }
  }

  const allSigned =
    ncndaContract?.status_signature === "assinado" && states.mandato.status === "SIGNED";

  return (
    <div className="space-y-5">
      {/* Seleção de documento */}
      <Card className="bg-[#162744] border border-[#243A66]">
        <CardHeader className="pb-3">
          <CardTitle className="text-[#F0ECE4] text-sm font-semibold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C9A84C]" />
            Documentos da Operação
          </CardTitle>
          {isDemo && (
            <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C] mt-1">
              Modo Demo — ClickSign simulado
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {CONTRATOS.map((c) => {
            const statusCfg = c.tipo === "nda" ? ncndaStatusLabel() : STATUS_CONFIG[states[c.tipo].status];
            const isActive = selectedTipo === c.tipo;

            return (
              <button
                key={c.tipo}
                onClick={() =>
                  setSelectedTipo(isActive ? null : c.tipo)
                }
                className={`w-full text-left rounded-lg border p-4 transition-all ${
                  isActive
                    ? "border-[#C9A84C] bg-[#243A66]/50"
                    : "border-[#243A66] bg-[#111F35] hover:border-[#243A66] hover:bg-[#243A66]/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 ${isActive ? "text-[#C9A84C]" : "text-[#7A8FA8]"}`}
                    >
                      {c.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[#F0ECE4] text-sm font-semibold">
                          {c.label}
                        </span>
                        <span className="text-[#7A8FA8] text-xs">
                          — {c.sublabel}
                        </span>
                      </div>
                      {isActive && (
                        <p className="text-[#7A8FA8] text-xs mt-1.5 leading-relaxed">
                          {c.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    className={`text-[10px] font-semibold shrink-0 flex items-center gap-1 ${statusCfg.badgeClass}`}
                  >
                    {statusCfg.icon}
                    {statusCfg.label}
                  </Badge>
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {/* Painel do documento selecionado */}
      {selected && currentState && selectedTipo && (
        <Card className="bg-[#162744] border border-[#243A66]">
          <CardHeader className="pb-3">
            <CardTitle className="text-[#F0ECE4] text-sm font-semibold flex items-center gap-2">
              {selected.icon}
              <span className="text-[#C9A84C]">{selected.label}</span>
              <span className="text-[#7A8FA8] font-normal">
                — {selected.sublabel}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedTipo === "nda" ? (
              // 05/09/2026 (BRIEF NCNDA Mesa M&A): substitui o envio direto via
              // ClickSign pela Central de Contratos (gera operation_contracts
              // com deal_id + esteira de qualificação), única forma de
              // "garantir que o contrato esteja na governança Client 360"
              // (pedido literal de João).
              <>
                {!ncndaContract && (
                  <div className="space-y-3">
                    <p className="text-[#7A8FA8] text-xs leading-relaxed">
                      Gera o NCNDA vinculado a este deal ({dealCode}) na Central de Contratos e cria o link de qualificação para a contraparte preencher CPF/CNPJ e dados civis.
                    </p>
                    <div className="grid gap-2.5">
                      <Input
                        placeholder="Nome completo da contraparte"
                        value={ncndaForm.full_name}
                        onChange={(e) => setNcndaForm((p) => ({ ...p, full_name: e.target.value }))}
                        className="bg-[#111F35] border-[#243A66] text-[#F0ECE4] text-sm"
                      />
                      <Input
                        placeholder="E-mail"
                        type="email"
                        value={ncndaForm.email}
                        onChange={(e) => setNcndaForm((p) => ({ ...p, email: e.target.value }))}
                        className="bg-[#111F35] border-[#243A66] text-[#F0ECE4] text-sm"
                      />
                      <Input
                        placeholder="Telefone (opcional)"
                        value={ncndaForm.phone}
                        onChange={(e) => setNcndaForm((p) => ({ ...p, phone: e.target.value }))}
                        className="bg-[#111F35] border-[#243A66] text-[#F0ECE4] text-sm"
                      />
                    </div>
                    {ncndaError && <p className="text-red-400 text-xs">{ncndaError}</p>}
                    {ncndaTemplateId === null && (
                      <p className="text-amber-400 text-xs">Nenhum template de NCNDA aprovado para a Mesa M&A. Peça ao Jurídico para aprovar a minuta em Central de Contratos {'>'} Minutas.</p>
                    )}
                    <Button
                      onClick={handleSolicitarNcnda}
                      disabled={ncndaSubmitting || ncndaTemplateId === null}
                      className="w-full bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold text-sm gap-2"
                    >
                      {ncndaSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Solicitando...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          Solicitar NCNDA
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {ncndaContract && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-[#111F35] border border-[#243A66] px-4 py-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C]">Contrato</p>
                        <p className="text-[#F0ECE4] text-sm font-medium mt-0.5">{ncndaContract.contract_code}</p>
                        <p className="text-[#7A8FA8] text-xs mt-0.5">{deal.target_company}</p>
                      </div>
                      <Link href="/juridico/contratos">
                        <Button variant="outline" size="sm" className="border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/10 text-xs gap-1.5">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Ver na Central de Contratos
                        </Button>
                      </Link>
                    </div>

                    {ncndaQualificationLink ? (
                      <div className="rounded-lg bg-[#111F35] border border-[#243A66] px-4 py-3 space-y-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C]">Link de Qualificação</p>
                        <div className="flex items-center gap-2">
                          <span className="text-[#7A8FA8] text-xs font-mono truncate flex-1">{ncndaQualificationLink}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] text-xs gap-1 shrink-0"
                            onClick={() => {
                              navigator.clipboard.writeText(ncndaQualificationLink);
                              setNcndaCopied(true);
                              setTimeout(() => setNcndaCopied(false), 2000);
                            }}
                          >
                            <Copy className="w-3 h-3" />
                            {ncndaCopied ? "Copiado" : "Copiar"}
                          </Button>
                          <a
                            href={`https://wa.me/?text=${encodeURIComponent(`Olá, segue o link para qualificação do NCNDA (${dealCode}) da V3 Partners: ${ncndaQualificationLink}`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm" className="border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] text-xs gap-1 shrink-0">
                              <MessageCircle className="w-3 h-3" />
                              WhatsApp
                            </Button>
                          </a>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[#7A8FA8] text-xs">Nenhum lote de qualificação encontrado para este contrato.</p>
                    )}
                  </div>
                )}
              </>
            ) : (
            <>
            {/* Preview */}
            <div className="flex items-center justify-between rounded-lg bg-[#111F35] border border-[#243A66] px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C]">
                  Documento
                </p>
                <p className="text-[#F0ECE4] text-sm font-medium mt-0.5">
                  {`MND-${dealCode}-...`}
                </p>
                <p className="text-[#7A8FA8] text-xs mt-0.5">
                  {deal.target_company}
                </p>
              </div>
              <a
                href={`/api/ma/gerar-contrato?dealId=${deal.id}&tipo=${selectedTipo}&lang=pt-br`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/10 text-xs gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visualizar
                </Button>
              </a>
            </div>

            {/* ClickSign — envio */}
            <div className="space-y-3">
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#7A8FA8]">
                Assinatura Digital via ClickSign
              </p>

              {currentState.status === "IDLE" && (
                <Button
                  onClick={() => handleEnviar(selectedTipo)}
                  disabled={currentState.sending}
                  className="w-full bg-[#C9A84C] hover:bg-[#E8C97A] text-[#09081A] font-semibold text-sm gap-2"
                >
                  {currentState.sending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Enviar para Assinatura via ClickSign
                    </>
                  )}
                </Button>
              )}

              {currentState.status !== "IDLE" && (
                <div className="space-y-3">
                  {/* Status badge */}
                  <div className="flex items-center gap-2 rounded-lg bg-[#111F35] border border-[#243A66] px-4 py-3">
                    <div className="flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C]">
                        Status ClickSign
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          className={`text-[10px] font-semibold flex items-center gap-1 ${STATUS_CONFIG[currentState.status].badgeClass}`}
                        >
                          {STATUS_CONFIG[currentState.status].icon}
                          {currentState.status}
                        </Badge>
                        <span className="text-[#7A8FA8] text-xs">
                          {STATUS_CONFIG[currentState.status].label}
                        </span>
                      </div>
                      {currentState.envelopeId && (
                        <p className="text-[#7A8FA8] text-[10px] mt-1 font-mono">
                          Envelope: {currentState.envelopeId}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleVerificarStatus(selectedTipo)}
                      disabled={currentState.checking}
                      className="border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] hover:border-[#243A66] text-xs gap-1.5 shrink-0"
                    >
                      {currentState.checking ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3.5 h-3.5" />
                      )}
                      Verificar Status
                    </Button>
                  </div>

                  {/* Link de assinatura simulado */}
                  {currentState.signUrl && currentState.status === "PENDING" && (
                    <div className="rounded-lg bg-[#111F35] border border-[#243A66] px-4 py-3">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C] mb-1.5">
                        Link de Assinatura
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="text-[#7A8FA8] text-xs font-mono truncate flex-1">
                          {currentState.signUrl}
                        </span>
                        <a
                          href={currentState.signUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-[#243A66] text-[#7A8FA8] hover:text-[#F0ECE4] text-xs gap-1 shrink-0"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Abrir
                          </Button>
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Reenviar se expirado */}
                  {currentState.status === "EXPIRED" && (
                    <Button
                      onClick={() => handleEnviar(selectedTipo)}
                      disabled={currentState.sending}
                      variant="outline"
                      className="w-full border-[#C9A84C] text-[#C9A84C] hover:bg-[#C9A84C]/10 text-sm gap-2"
                    >
                      <Send className="w-4 h-4" />
                      Reenviar para Assinatura
                    </Button>
                  )}
                </div>
              )}
            </div>
            </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Banner de documentos assinados */}
      {allSigned && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <p className="text-emerald-400 text-sm font-semibold">
                Documentos assinados
              </p>
              <p className="text-[#7A8FA8] text-xs mt-0.5">
                Kit de Criativos liberado para divulgação
              </p>
            </div>
          </div>
          <Link href={`/ma/${deal.id}/criativos`}>
            <Button
              size="sm"
              className="bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-xs gap-1.5 shrink-0"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Ir para Criativos
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
