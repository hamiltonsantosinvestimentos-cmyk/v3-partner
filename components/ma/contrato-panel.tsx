"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

export default function ContratoPanel({ deal, dealCode, isDemo = false }: ContratoPanelProps) {
  const [selectedTipo, setSelectedTipo] = useState<DocType | null>(null);
  const [states, setStates] = useState<Record<DocType, ContratoState>>({
    nda: { ...INITIAL_STATE },
    mandato: { ...INITIAL_STATE },
  });

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
    states.nda.status === "SIGNED" && states.mandato.status === "SIGNED";

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
            const st = states[c.tipo];
            const statusCfg = STATUS_CONFIG[st.status];
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
            {/* Preview */}
            <div className="flex items-center justify-between rounded-lg bg-[#111F35] border border-[#243A66] px-4 py-3">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#C9A84C]">
                  Documento
                </p>
                <p className="text-[#F0ECE4] text-sm font-medium mt-0.5">
                  {selectedTipo === "nda"
                    ? `NDA-${dealCode}-...`
                    : `MND-${dealCode}-...`}
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
