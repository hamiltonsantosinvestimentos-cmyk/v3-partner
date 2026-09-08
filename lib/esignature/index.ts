// lib/esignature/index.ts
//
// Factory do provedor de assinatura digital (Fase 1, 07/09/2026). Hoje
// sempre resolve para ClickSign, ignorando o contexto por completo — a
// assinatura já aceita o contexto que a Fase 2 vai usar de verdade para
// rotear por vertical/contrato/documentType entre ClickSign e CertOne, sem
// exigir alterar de novo os 12 call sites que já chamam getProvider(ctx)
// desde esta extração.
import type { ESignatureProvider, EsignatureContext } from "./types";
import { clickSignProvider } from "./clicksign-provider";
import { certOneProvider } from "./certone-provider";

export function getProvider(context: EsignatureContext = {}): ESignatureProvider {
  // Fase 2 (08/09/2026): o provider CertOne já existe e pode ser chamado
  // via override explícito (context.provider === "certone"), útil para o
  // primeiro teste manual assim que houver API key de homologação. O
  // roteamento automático por vertical/contrato (ler
  // operation_contracts.esignature_provider ou uma config por vertical)
  // ainda NÃO acontece aqui — isso é a Fase 3 (switch no painel). Sem
  // override, o comportamento é idêntico ao de antes: sempre ClickSign,
  // nenhum contrato real muda.
  if (context.provider === "certone") return certOneProvider;
  if (context.provider && context.provider !== "clicksign") {
    throw new Error(`Provedor de assinatura "${context.provider}" desconhecido.`);
  }
  return clickSignProvider;
}

export { htmlToPdfBase64 } from "./clicksign-provider";
export { clickSignProvider } from "./clicksign-provider";
export { certOneProvider } from "./certone-provider";
export type {
  ESignatureProvider,
  EsignatureContext,
  EsignatureProviderName,
  EsignatureSignatory,
  SendEnvelopeInput,
  SendEnvelopeResult,
  EnvelopeStatusResult,
  CancelResult,
  NotifyResult,
  WebhookParseResult,
} from "./types";
