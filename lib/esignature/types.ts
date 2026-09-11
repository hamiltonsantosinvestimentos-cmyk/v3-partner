// lib/esignature/types.ts
//
// Interface comum de provedor de assinatura digital (Fase 1 do BRIEF
// "ClickSign vs CertOne", 07/09/2026). Hoje só existe um provedor real por
// trás dela (clicksign-provider.ts, extraído de lib/clicksign.ts sem mudar
// nenhum comportamento). CertOne entra na Fase 2, depois das respostas
// pendentes sobre formato de upload (HTML vs PDF) e customização de e-mail
// (ver mensagens enviadas a Gustavo/Gabriel em 07/09/2026).
//
// Ajustes pedidos por João antes do "go" desta fase (registrar o motivo,
// não só o resultado):
//   1. getProvider() já recebe um contexto (EsignatureContext), mesmo que a
//      Fase 1 o ignore por completo e sempre devolva ClickSign. Isso evita
//      que os 12 call sites precisem ser tocados de novo quando a Fase 2
//      passar a rotear de verdade por vertical/documentType.
//   2. A interface já expõe syncStatus() (poll ativo, como o ClickSign
//      exige hoje) e um parseWebhookEvent() opcional (fundação para um
//      provedor com webhook nativo confiável, candidato: CertOne).

export type EsignatureProviderName = "clicksign" | "certone";

export interface EsignatureContext {
  /** operation_contracts.id, quando o call site já tiver o contrato carregado. */
  contractId?: string;
  /** ma_deals.id (ou dealCode), quando o call site não tiver contractId ainda. */
  dealId?: string;
  /** "ma" | "cm" | "capital_markets" | "credito" | ... quando conhecido. */
  vertical?: string;
  /** mesmo domínio de SendEnvelopeInput["documentType"]. */
  documentType?: string;
  /** override explícito (ex: teste manual). Falha alto se o provedor pedido não existir ainda. */
  provider?: EsignatureProviderName;
}

export interface EsignatureSignatory {
  name: string;
  email: string;
  /**
   * CPF/CNPJ da parte, quando disponível (mesmo campo `doc` de
   * operation_contracts.parties). Não usado pela ClickSign. A CertOne EXIGE
   * um CPF válido por signatário (`flowActions[].user.identifier`,
   * confirmado ao vivo em 11/09/2026 -- a API valida de verdade, rejeita
   * CNPJ e qualquer string que não seja CPF real). Decisão de João
   * (11/09/2026): quando a parte é PJ, o CPF a usar é o do representante
   * legal -- já é o padrão real hoje para sócios V3 (parties.doc já guarda
   * o CPF pessoal de quem assina, não o CNPJ da V3), mas contrapartes PJ
   * externas cadastradas só com CNPJ (ex: MEI que assina pelo CNPJ) não têm
   * hoje um CPF individual separado capturado -- certone-provider.ts falha
   * explicitamente nesse caso, nunca tenta adivinhar.
   */
  document?: string | null;
}

export interface SendEnvelopeInput {
  dealId: string;
  documentType:
    | "nda"
    | "mandato"
    | "loi"
    | "contrato_venda"
    | "fpa_venda"
    | "fpa_compra"
    | "nda_quadripartite"
    | "contrato_final";
  signatories: EsignatureSignatory[];
  documentUrl?: string;
  documentLabel?: string;
  watcherEmail?: string;
  signatureMessage?: string;
  signatureSubject?: string;
  documentContentBase64?: string;
  /**
   * Assinatura Posicionada (BRIEF 11/09/2026): quando presente junto com
   * `positionedParties`, o provedor usa o caminho de Modelo/.docx (tag
   * {{~position_sign_N}} + requisito rubricate) em vez do upload direto de
   * PDF. `positionedParties` precisa estar na MESMA ordem usada para gerar
   * o .docx (renderContractDocx) -- a posição N na lista é o que liga cada
   * signatório à sua tag. Só implementado no ClickSign por enquanto; outro
   * provedor sem suporte ignora os dois campos e cai no caminho normal.
   */
  documentDocxBase64?: string;
  positionedParties?: Array<{ name: string; email: string }>;
}

export type SendEnvelopeResult =
  | { ok: true; envelopeId: string; documentId: string | null; signUrl: string; status: "PENDING" }
  | { ok: false; error: string; status: number };

export type NotifyResult = { ok: true } | { ok: false; error: string; status: number };

export type EnvelopeStatusResult =
  | { ok: true; status: string; signedDocumentUrl: string | null }
  | { ok: false; error: string; status: number };

export type CancelResult = { ok: true } | { ok: false; error: string; status: number };

// Fase 2: payload normalizado de um evento de webhook, independente do
// provedor de origem. Um futuro /api/webhooks/[provider] (ou o próprio
// app/api/ma/clicksign-webhook, se for migrado depois) atualiza
// operation_contracts/ma_deals a partir deste formato único, nunca do
// payload bruto de cada provedor.
export interface WebhookParseResult {
  ok: boolean;
  envelopeId: string | null;
  status: "signed" | "closed" | "canceled" | "refused" | "created" | "unknown";
  raw?: unknown;
}

export interface ESignatureProvider {
  readonly name: EsignatureProviderName;
  send(input: SendEnvelopeInput): Promise<SendEnvelopeResult>;
  /** Poll ativo de status (o ClickSign exige isso hoje, via /api/cron/clicksign-sync). */
  syncStatus(externalId: string): Promise<EnvelopeStatusResult>;
  cancel(externalId: string, documentId?: string | null): Promise<CancelResult>;
  notifyReminder(
    externalId: string,
    signatoryName: string,
    documentLabel: string,
    customMessage?: string,
    customSubject?: string
  ): Promise<NotifyResult>;
  /**
   * Fase 2, opcional: só provedores com webhook nativo confiável (candidato:
   * CertOne, ver ponto 3 das mensagens a Gustavo/Gabriel sobre cadastro de
   * URL de callback) implementam isto. Verifica assinatura/HMAC quando
   * aplicável e devolve o evento já normalizado. Ausente = provedor ainda
   * depende só de poll ativo (syncStatus), caso do ClickSign hoje.
   */
  parseWebhookEvent?(rawBody: string, headers: Record<string, string>): WebhookParseResult | null;
}
