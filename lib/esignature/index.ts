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

export function getProvider(context: EsignatureContext = {}): ESignatureProvider {
  // Fase 1: o contexto ainda não influencia a escolha (sempre ClickSign).
  // Um override explícito para um provedor não implementado falha alto e
  // claro, em vez de cair em silêncio no ClickSign por padrão.
  if (context.provider && context.provider !== "clicksign") {
    throw new Error(`Provedor de assinatura "${context.provider}" ainda não implementado (Fase 2 pendente, ver BRIEF ClickSign vs CertOne).`);
  }
  return clickSignProvider;
}

export { htmlToPdfBase64 } from "./clicksign-provider";
export { clickSignProvider } from "./clicksign-provider";
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
