// lib/clicksign.ts
//
// DEPRECATED (07/09/2026, Fase 1 da camada de abstração de assinatura
// digital). A lógica real foi extraída, sem alteração de comportamento,
// para lib/esignature/clicksign-provider.ts. Este arquivo existe só como
// rede de segurança para qualquer import que o grep de 12 call sites reais
// não tenha pego — nenhum arquivo do repositório precisa dele depois desta
// extração. Novos call sites devem importar de "@/lib/esignature"
// (getProvider().send(), .syncStatus(), .cancel(), .notifyReminder()) e
// nunca deste arquivo.
export {
  sendToClickSign,
  notifyClickSignEnvelope,
  getEnvelopeStatusV3,
  cancelClickSignDocument,
  htmlToPdfBase64,
} from "./esignature/clicksign-provider";

export type {
  EsignatureSignatory as ClickSignSignatory,
  SendEnvelopeInput as SendToClickSignInput,
  SendEnvelopeResult as SendToClickSignResult,
  EnvelopeStatusResult as EnvelopeStatusV3Result,
  CancelResult as CancelClickSignDocumentResult,
  NotifyResult as NotifyClickSignResult,
} from "./esignature/types";
