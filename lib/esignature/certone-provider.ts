// lib/esignature/certone-provider.ts
//
// Provider CertOne (Fase 2 do BRIEF "ClickSign vs CertOne", 08/09/2026).
// Construído mecanicamente contra o Swagger oficial (SwaggerHub, cert-one
// v1.60.0, lido ao vivo em 07/09/2026) e as 10 respostas reais de
// Gustavo/Gabriel (CertOne) recebidas em 08/09/2026. NENHUMA chamada real
// foi testada ainda nesta sessão (sem API key de homologação disponível) —
// cada campo de resposta cuja forma exata eu não confirmei no Swagger está
// marcado explicitamente abaixo com "ASSUMIDO" e uma leitura defensiva
// (tenta mais de uma chave), mesmo padrão já usado neste projeto para o
// primeiro parsing do webhook v3 da ClickSign (28/07/2026): documentar a
// suposição, nunca fingir certeza, corrigir no primeiro teste real.
//
// Confirmado com a CertOne (08/09/2026), não é suposição:
//   - Disparo do e-mail é automático ao criar o documento (sem "activate").
//   - Corpo do e-mail é customizável por documento via um campo de
//     descrição na criação do documento.
//   - Cancelar 1 documento cancela o envelope/fluxo inteiro (diferente da
//     ClickSign, que cancela só o documento).
//   - Lembrete sempre repete o e-mail original, sem mensagem customizada
//     (limitação real, não implementar um customMessage que a API ignora).
//   - Sem restrição de caracteres no nome do signatário.
//   - Existe um campo "title" no nível da ação de assinatura (o que o
//     representante da CertOne chamou de "signer.title") para qualificar
//     o papel do signatário (ex: "Testemunha"), sem afetar o fluxo. O
//     SendEnvelopeInput comum (lib/esignature/types.ts) não carrega esse
//     dado hoje (só name/email) — fica como melhoria natural da Fase 3,
//     quando o roteamento por vertical/role for desenhado de verdade.

import type {
  ESignatureProvider,
  SendEnvelopeInput,
  SendEnvelopeResult,
  EnvelopeStatusResult,
  CancelResult,
  NotifyResult,
  WebhookParseResult,
} from "./types";

const BASE_URL = process.env.CERTONE_BASE_URL ?? "https://assinador.certdigitaltech.com.br";

function headers(): Record<string, string> {
  const apiKey = process.env.CERTONE_API_KEY;
  if (!apiKey) throw new Error("CERTONE_API_KEY não configurado");
  return { "X-Api-Key": apiKey, "Content-Type": "application/json", Accept: "application/json" };
}

// POST /api/uploads/bytes: upload via JSON (content_base64), mais simples
// que multipart/form-data a partir de uma serverless function. Formato do
// documento: a CertOne acredita que precisa ser PDF (mesma exigência da
// ClickSign hoje), ainda vai confirmar se aceita HTML direto — por isso
// este provider assume PDF e reaproveita htmlToPdfBase64 (provider-
// agnóstico, ver clicksign-provider.ts) exatamente como o provider
// ClickSign já faz, sem duplicar a lógica de conversão.
async function uploadDocument(contentBase64WithPrefix: string, fileName: string): Promise<string> {
  const base64 = contentBase64WithPrefix.replace(/^data:.*;base64,/, "");
  const res = await fetch(`${BASE_URL}/api/uploads/bytes`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ fileName, contentBase64: base64 }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`CertOne uploadDocument: ${err}`);
  }
  const data = await res.json();
  // ASSUMIDO: UploadModel não foi expandido no Swagger lido em 07/09; o
  // padrão do resto da API (Documents.DocumentModel, etc.) usa "id" como
  // chave primária, então assumo o mesmo aqui até o primeiro teste real.
  const fileId: string | undefined = data?.id ?? data?.fileId;
  if (!fileId) throw new Error(`CertOne uploadDocument: resposta sem id reconhecível: ${JSON.stringify(data)}`);
  return fileId;
}

export async function sendToCertOne(input: SendEnvelopeInput): Promise<SendEnvelopeResult> {
  const apiKey = process.env.CERTONE_API_KEY;
  if (!apiKey) return { ok: false, error: "CERTONE_API_KEY não configurado", status: 500 };

  const { dealId, documentLabel: overrideLabel, signatories, watcherEmail } = input;
  if (!dealId || !signatories?.length) {
    return { ok: false, error: "dealId e signatories são obrigatórios", status: 400 };
  }

  try {
    const documentLabel = overrideLabel ?? `Documento, Deal ${dealId}`;

    // O htmlToPdfBase64 é importado dinamicamente para não criar um ciclo
    // de import (clicksign-provider.ts não depende deste arquivo, mas
    // ambos vivem no mesmo diretório e são consumidos por index.ts).
    const { htmlToPdfBase64 } = await import("./clicksign-provider");

    let contentBase64: string;
    if (input.documentContentBase64) {
      contentBase64 = input.documentContentBase64;
    } else if (input.documentUrl) {
      const htmlRes = await fetch(input.documentUrl);
      if (!htmlRes.ok) {
        return { ok: false, error: `Falha ao buscar o conteúdo do documento em ${input.documentUrl}: HTTP ${htmlRes.status}`, status: 502 };
      }
      const html = await htmlRes.text();
      contentBase64 = await htmlToPdfBase64(html);
    } else {
      return { ok: false, error: "documentUrl ou documentContentBase64 obrigatório", status: 400 };
    }

    const fileId = await uploadDocument(contentBase64, `${documentLabel}.pdf`);

    // FlowActions.FlowActionCreateModel por signatário: type "Signer"
    // confirmado no Swagger (FlowActionType: Signer | Approver | SignRule).
    // "title" fica de fora nesta fase (SendEnvelopeInput não carrega role
    // ainda, ver comentário no topo do arquivo).
    const flowActions = signatories.map((s) => ({
      type: "Signer",
      user: { name: s.name, email: s.email },
    }));

    const observers = watcherEmail ? [{ user: { email: watcherEmail } }] : undefined;

    const createRes = await fetch(`${BASE_URL}/api/documents`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: documentLabel,
        files: [{ id: fileId }],
        flowActions,
        ...(observers ? { observers } : {}),
        // Corpo do e-mail customizado (confirmado 08/09/2026 com a
        // CertOne): o campo de descrição é o equivalente ao
        // email_customization.principal da ClickSign.
        ...(input.signatureMessage ? { description: input.signatureMessage } : {}),
      }),
    });
    if (!createRes.ok) {
      const err = await createRes.text();
      return { ok: false, error: `CertOne createDocument: ${err}`, status: 502 };
    }
    const createData = await createRes.json();
    // ASSUMIDO: Documents.CreateDocumentResult não foi expandido no Swagger
    // lido; "cria um ou vários documentos" sugere um array. Leitura
    // defensiva até o primeiro teste real confirmar a forma exata.
    const documentId: string | undefined =
      createData?.id ?? createData?.documentId ?? createData?.data?.[0]?.id ?? createData?.documents?.[0]?.id;
    if (!documentId) {
      return { ok: false, error: `CertOne createDocument: resposta sem id reconhecível: ${JSON.stringify(createData)}`, status: 502 };
    }

    // E-mail de assinatura sai sozinho neste ponto (confirmado 08/09/2026:
    // sem "activate" separado, diferente da ClickSign v3).

    // action-url: equivalente ao signUrl. ASSUMIDO Documents.ActionUrlResponse
    // não expandido; leitura defensiva.
    let signUrl = `${BASE_URL}/documents/${documentId}`;
    try {
      const actionRes = await fetch(`${BASE_URL}/api/documents/${documentId}/action-url`, {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({}),
      });
      if (actionRes.ok) {
        const actionData = await actionRes.json();
        signUrl = actionData?.url ?? actionData?.actionUrl ?? actionData?.link ?? signUrl;
      }
    } catch {
      // action-url é conveniência (link direto); falha aqui não invalida o envio.
    }

    return { ok: true, envelopeId: documentId, documentId, signUrl, status: "PENDING" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

export async function getCertOneStatus(documentId: string): Promise<EnvelopeStatusResult> {
  const apiKey = process.env.CERTONE_API_KEY;
  if (!apiKey) return { ok: false, error: "CERTONE_API_KEY não configurado", status: 500 };

  try {
    const res = await fetch(`${BASE_URL}/api/documents/${documentId}`, { headers: headers() });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: `CertOne getDocument: ${err}`, status: res.status };
    }
    const data = await res.json();
    // DocumentStatus confirmado no Swagger: Pending | Refused | FlowConcluded
    // | Concluded | Canceled | Expired.
    const status: string = data?.status ?? "desconhecido";

    let signedDocumentUrl: string | null = null;
    if (status === "Concluded" || status === "FlowConcluded") {
      // Download direto confirmado no Swagger (diferencial real frente à
      // ClickSign, que exige poller de e-mail como fallback). Devolve a
      // própria URL da API: quem consumir decide se baixa na hora
      // (a rota de ticket dá uma URL temporária, mais adequada para
      // repasse a terceiros; aqui usamos o download direto).
      signedDocumentUrl = `${BASE_URL}/api/documents/${documentId}/content?type=signed`;
    }

    return { ok: true, status, signedDocumentUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

// Cancela o documento — CONFIRMADO 08/09/2026: cancelar 1 documento cancela
// o ENVELOPE/FLUXO INTEIRO, diferente da ClickSign (só o documento
// individual). Hoje o V3 sempre envia 1 documento por envelope, então não
// há efeito colateral real, mas fica documentado para quando algum fluxo
// futuro agrupar documentos.
export async function cancelCertOneDocument(documentId: string): Promise<CancelResult> {
  const apiKey = process.env.CERTONE_API_KEY;
  if (!apiKey) return { ok: false, error: "CERTONE_API_KEY não configurado", status: 500 };

  try {
    const res = await fetch(`${BASE_URL}/api/documents/${documentId}/cancellation`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ reason: "Cancelamento automático, V3 Partners (edição de contrato)" }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err, status: res.status };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

// CONFIRMADO 08/09/2026: o lembrete sempre repete o e-mail original, sem
// texto customizado. customMessage/customSubject são aceitos na assinatura
// (para bater com a interface comum) mas IGNORADOS de propósito — nunca
// fingir suporte a algo que a API não entrega.
export async function notifyCertOneReminder(
  documentId: string,
  _signatoryName: string,
  _documentLabel: string,
  _customMessage?: string,
  _customSubject?: string
): Promise<NotifyResult> {
  const apiKey = process.env.CERTONE_API_KEY;
  if (!apiKey) return { ok: false, error: "CERTONE_API_KEY não configurado", status: 500 };

  try {
    const res = await fetch(`${BASE_URL}/api/notifications/flow-action-reminder`, {
      method: "POST",
      headers: headers(),
      // ASSUMIDO: Notifications.CreateFlowActionReminderRequest não
      // expandido no Swagger lido; "documentId" é o campo mais provável
      // dado o padrão do resto da API, a confirmar no primeiro teste real.
      body: JSON.stringify({ documentId }),
    });
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, error: err, status: 502 };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

// Fase 2: esqueleto de normalização de webhook. A forma exata do payload
// (campo que identifica o tipo de evento dentro de Webhooks.WebhookModel)
// NÃO foi confirmada no Swagger lido em 07/09/2026 (só a tabela de eventos
// disponíveis: DocumentSigned, DocumentApproved, DocumentRefused,
// DocumentConcluded, DocumentCanceled, DocumentsCreated). Leitura
// defensiva, mesmo padrão já usado no primeiro parsing do webhook v3 da
// ClickSign: loga o bruto (na rota, não aqui) e corrige após o 1º evento
// real, sem cadastro de webhook feito ainda (depende de ação manual no
// painel da CertOne, ver BRIEF Seção 2.4).
export function parseCertOneWebhookEvent(rawBody: string): WebhookParseResult | null {
  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const eventName: string | undefined = payload?.event ?? payload?.type ?? payload?.eventType;
  const documentId: string | undefined = payload?.data?.id ?? payload?.document?.id ?? payload?.id;

  const map: Record<string, WebhookParseResult["status"]> = {
    DocumentSigned: "signed",
    DocumentConcluded: "closed",
    DocumentApproved: "signed",
    DocumentRefused: "refused",
    DocumentCanceled: "canceled",
    DocumentsCreated: "created",
  };

  return {
    ok: true,
    envelopeId: documentId ?? null,
    status: (eventName && map[eventName]) || "unknown",
    raw: payload,
  };
}

export const certOneProvider: ESignatureProvider = {
  name: "certone",
  send: sendToCertOne,
  syncStatus: getCertOneStatus,
  cancel: (externalId) => cancelCertOneDocument(externalId),
  notifyReminder: notifyCertOneReminder,
  parseWebhookEvent: (rawBody) => parseCertOneWebhookEvent(rawBody),
};
