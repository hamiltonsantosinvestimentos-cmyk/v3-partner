// lib/esignature/clicksign-provider.ts
//
// Extraído de lib/clicksign.ts (07/09/2026, Fase 1 da camada de abstração
// de assinatura digital). Extração MECÂNICA: mesma lógica, mesmos
// endpoints, mesmos headers, mesmos payloads, testados ao vivo contra
// produção em várias sessões anteriores (ver session-decisions.md, ciclo
// ClickSign de 11/08 a 19/08/2026). Nenhuma chamada de rede muda nesta
// extração — só a casca (nomes de tipo, wiring da interface comum) muda.
//
// lib/clicksign.ts agora é um re-export deste arquivo, mantido só por
// segurança (nenhum outro arquivo do repositório o importa mais, conferido
// por grep antes desta extração, 12 call sites reais, todos migrados para
// "@/lib/esignature" no mesmo commit).

import { auditText } from "@/lib/brand-guardian-gate";
import type {
  ESignatureProvider,
  SendEnvelopeInput,
  SendEnvelopeResult,
  EnvelopeStatusResult,
  CancelResult,
  NotifyResult,
} from "./types";

// documentTypes que usam a API v3 (envelopes), confirmadamente funcional.
// "nda" continua na v1 depreciada (fluxo M&A original, não tocado aqui).
const V3_DOCUMENT_TYPES = new Set([
  "loi",
  "contrato_venda",
  "fpa_venda",
  "fpa_compra",
  "mandato",
  "nda_quadripartite",
  "contrato_final",
]);

const IS_DEMO = false;

// Notifica o(s) signatário(s) de um envelope v3 já ativo (envia/reenvia o
// e-mail de assinatura). Extraído de sendToClickSignV3 para ser reutilizável
// pelo botão "Reenviar notificação" do painel de acompanhamento, sem
// duplicar a copy já aprovada pelo brand-guardian em dois lugares.
export async function notifyClickSignEnvelope(
  envelopeId: string,
  signatoryName: string,
  documentLabel: string,
  customMessage?: string,
  customSubject?: string
): Promise<NotifyResult> {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";
  if (!accessToken) return { ok: false, error: "CLICKSIGN_ACCESS_TOKEN não configurado", status: 500 };

  const safeLabel = auditText(documentLabel).corrected;
  const safeName = auditText(signatoryName || "Sr(a)").corrected;
  const subject = customSubject
    ? auditText(customSubject).corrected
    : auditText(`V3 Partners: Assinatura Digital, ${safeLabel}`).corrected;
  const greeting = customMessage ? "" : auditText(`Prezado(a) ${safeName},`).corrected;
  const principal = customMessage
    ? auditText(customMessage).corrected
    : auditText(
        `A V3 Partners encaminha o documento "${safeLabel}" para sua assinatura digital. Revise o documento e confirme sua assinatura abaixo.`
      ).corrected;

  const notifyRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/vnd.api+json",
      Accept: "application/json",
      Authorization: accessToken,
    },
    body: JSON.stringify({
      data: {
        type: "notifications",
        attributes: {
          message: null,
          email_customization: {
            subject,
            head: "V3 Partners Soluções Ltda",
            greeting,
            principal,
            button: "Verificar e Assinar",
            final: "Em caso de dúvidas, entre em contato com privacidade@v3partners.com.br.",
            align: "left",
            show_token: true,
          },
        },
      },
    }),
  });

  if (!notifyRes.ok) {
    const err = await notifyRes.text();
    return { ok: false, error: err, status: 502 };
  }
  return { ok: true };
}

async function launchBrowser() {
  if (process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const puppeteer = (await import("puppeteer-core")).default;
    return puppeteer.launch({
      args: [...(chromium.args ?? []), "--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1240, height: 1754 },
      executablePath: await chromium.executablePath(
        "https://github.com/Sparticuz/chromium/releases/download/v133.0.0/chromium-v133.0.0-pack.tar"
      ),
      headless: true,
    });
  }
  const puppeteer = (await import("puppeteer-core")).default;
  return puppeteer.launch({
    args: ["--no-sandbox"],
    defaultViewport: { width: 1240, height: 1754 },
    executablePath:
      process.platform === "win32"
        ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
        : "/usr/bin/google-chrome",
    headless: true,
  });
}

// ClickSign só aceita PDF, Word, imagem ou TXT como documento (confirmado ao
// vivo). Utilitário de renderização, provider-agnóstico por natureza (o
// CertOne, a confirmar, pode aceitar HTML direto — ver ponto 1 das
// mensagens a Gustavo/Gabriel de 07/09/2026); fica exposto solto em vez de
// dentro da interface ESignatureProvider, porque "renderizar HTML em PDF"
// não é uma operação de assinatura, é um passo de preparo de documento que
// qualquer provedor pode ou não precisar.
export async function htmlToPdfBase64(html: string): Promise<string> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "0", bottom: "0", left: "0", right: "0" },
    });
    return `data:application/pdf;base64,${Buffer.from(pdfBuffer).toString("base64")}`;
  } finally {
    await browser.close();
  }
}

// Dispara um documento para assinatura digital real no ClickSign.
export async function sendToClickSign(input: SendEnvelopeInput): Promise<SendEnvelopeResult> {
  if (V3_DOCUMENT_TYPES.has(input.documentType)) {
    return sendToClickSignV3(input);
  }
  return sendToClickSignV1(input);
}

// Fluxo v3 (envelopes), confirmado ponta a ponta contra a conta de produção
// real: criar envelope → upload documento → criar signatário → 2 requisitos
// (agree/sign = consentimento de assinatura, provide_evidence/email =
// autenticação) → ativar (status: running, dispara o e-mail real).
async function sendToClickSignV3(input: SendEnvelopeInput): Promise<SendEnvelopeResult> {
  const { dealId, documentType, signatories, documentUrl: overrideUrl, documentLabel: overrideLabel } = input;

  if (!dealId || !documentType || !signatories?.length) {
    return { ok: false, error: "dealId, documentType e signatories são obrigatórios", status: 400 };
  }

  if (IS_DEMO) {
    return {
      ok: true,
      envelopeId: `DEMO-ENV-${Date.now()}`,
      documentId: null,
      signUrl: "https://app.clicksign.com/sign/demo",
      status: "PENDING",
    };
  }

  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";

  if (!accessToken) {
    return { ok: false, error: "CLICKSIGN_ACCESS_TOKEN não configurado", status: 500 };
  }

  const headers = {
    "Content-Type": "application/vnd.api+json",
    Accept: "application/json",
    Authorization: accessToken,
  };

  try {
    const documentLabel = overrideLabel ?? `Carta de Intenção, Deal ${dealId}`;

    // Assinatura Posicionada (11/09/2026): quando o chamador manda o .docx
    // pronto + a lista de partes na mesma ordem das tags, usamos Modelo →
    // Documento-a-partir-do-Modelo em vez de upload direto de PDF. Mecânica
    // confirmada ao vivo nesta sessão contra a API real (Modelo 201,
    // Documento-de-Modelo 201, Requisito rubricate 201 com rubric_field
    // ecoado). Qualquer falha neste caminho cai no erro normal de baixo,
    // nunca tenta silenciosamente o caminho PDF como fallback (silencioso
    // aqui esconderia posicionamento quebrado atrás de um envio "normal").
    const usePositioned = !!(input.documentDocxBase64 && input.positionedParties?.length);
    let documentId: string;
    let envelopeId: string;

    if (usePositioned) {
      const templateRes = await fetch(`${baseUrl}/api/v3/templates`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "templates",
            attributes: {
              name: `${documentLabel} (auto)`,
              content_base64: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${input.documentDocxBase64}`,
            },
          },
        }),
      });
      if (!templateRes.ok) {
        const err = await templateRes.text();
        return { ok: false, error: `ClickSign createTemplate (assinatura posicionada): ${err}`, status: 502 };
      }
      const templateData = await templateRes.json();
      const templateId: string = templateData.data?.id;

      const envelopeRes = await fetch(`${baseUrl}/api/v3/envelopes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "envelopes",
            attributes: { name: documentLabel, locale: "pt-BR", auto_close: true, remind_interval: 3 },
          },
        }),
      });
      if (!envelopeRes.ok) {
        const err = await envelopeRes.text();
        return { ok: false, error: `ClickSign createEnvelope: ${err}`, status: 502 };
      }
      envelopeId = (await envelopeRes.json()).data?.id;

      const docRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "documents",
            attributes: { filename: `${documentLabel}.docx`, template: { key: templateId, data: {} } },
          },
        }),
      });
      if (!docRes.ok) {
        const err = await docRes.text();
        return { ok: false, error: `ClickSign createDocumentFromTemplate (assinatura posicionada): ${err}`, status: 502 };
      }
      documentId = (await docRes.json()).data?.id;
    } else {
      let contentBase64: string;
      if (input.documentContentBase64) {
        contentBase64 = input.documentContentBase64;
      } else {
        const documentUrl =
          overrideUrl ??
          `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/ma/gerar-contrato?dealId=${dealId}&tipo=${documentType}&lang=pt-br`;
        const htmlRes = await fetch(documentUrl);
        if (!htmlRes.ok) {
          return { ok: false, error: `Falha ao buscar o conteúdo do documento em ${documentUrl}: HTTP ${htmlRes.status}`, status: 502 };
        }
        const html = await htmlRes.text();
        contentBase64 = await htmlToPdfBase64(html);
      }

      const envelopeRes = await fetch(`${baseUrl}/api/v3/envelopes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "envelopes",
            attributes: { name: documentLabel, locale: "pt-BR", auto_close: true, remind_interval: 3 },
          },
        }),
      });
      if (!envelopeRes.ok) {
        const err = await envelopeRes.text();
        return { ok: false, error: `ClickSign createEnvelope: ${err}`, status: 502 };
      }
      envelopeId = (await envelopeRes.json()).data?.id;

      const docRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "documents",
            attributes: { filename: `${documentLabel}.pdf`, content_base64: contentBase64 },
          },
        }),
      });
      if (!docRes.ok) {
        const err = await docRes.text();
        return { ok: false, error: `ClickSign uploadDocument: ${err}`, status: 502 };
      }
      documentId = (await docRes.json()).data?.id;
    }

    // Observador de Assinatura: best-effort, nunca falha o envio inteiro.
    if (input.watcherEmail) {
      const watcherRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/signature_watchers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "signature_watchers",
            attributes: {
              email: input.watcherEmail,
              kind: "all_steps",
              communicate_events: { signature_watcher_envelope_closed: "email" },
              attach_documents_enabled: true,
            },
          },
        }),
      });
      if (!watcherRes.ok) {
        console.error(`[esignature/clicksign] falha ao cadastrar observador (${input.watcherEmail}) no envelope ${envelopeId}:`, await watcherRes.text());
      }
    }

    for (const signatory of signatories) {
      const signerRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/signers`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "signers",
            attributes: { name: signatory.name, email: signatory.email, has_documentation: false },
          },
        }),
      });
      if (!signerRes.ok) {
        const err = await signerRes.text();
        return { ok: false, error: `ClickSign createSigner (${signatory.email}): ${err}`, status: 502 };
      }
      const signerData = await signerRes.json();
      const signerId: string = signerData.data?.id;

      const requirementRelationships = {
        document: { data: { type: "documents", id: documentId } },
        signer: { data: { type: "signers", id: signerId } },
      };

      const qualificationRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/requirements`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "requirements",
            attributes: { action: "agree", role: "sign" },
            relationships: requirementRelationships,
          },
        }),
      });
      if (!qualificationRes.ok) {
        const err = await qualificationRes.text();
        return { ok: false, error: `ClickSign createRequirement (assinatura, ${signatory.email}): ${err}`, status: 502 };
      }

      const authRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/requirements`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          data: {
            type: "requirements",
            attributes: { action: "provide_evidence", auth: "email" },
            relationships: requirementRelationships,
          },
        }),
      });
      if (!authRes.ok) {
        const err = await authRes.text();
        return { ok: false, error: `ClickSign createRequirement (autenticação, ${signatory.email}): ${err}`, status: 502 };
      }

      // Assinatura Posicionada: rubricate/manuscript ligando este
      // signatário à tag {{~position_sign_N}} correspondente no .docx. A
      // posição N é o índice (1-based) do e-mail dele dentro de
      // positionedParties -- precisa ser EXATAMENTE a mesma ordem usada por
      // renderContractDocx() pra gerar as tags, quem garante isso é o
      // chamador (ver contract-docx-render.ts). Se o e-mail não for achado
      // (positionedParties incompleto/divergente), pula silenciosamente
      // este signatário específico em vez de falhar o envio inteiro -- ele
      // ainda assina normalmente via "agree/sign" acima, só não ganha a
      // marca visual posicionada.
      if (usePositioned) {
        const tagIndex = input.positionedParties!.findIndex((p) => p.email.toLowerCase() === signatory.email.toLowerCase());
        if (tagIndex >= 0) {
          const rubricRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/requirements`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              data: {
                type: "requirements",
                attributes: { action: "rubricate", kind: "manuscript", rubric_field: `position_sign_${tagIndex + 1}` },
                relationships: requirementRelationships,
              },
            }),
          });
          if (!rubricRes.ok) {
            console.error(`[esignature/clicksign] falha ao criar rubricate posicionado (${signatory.email}, tag ${tagIndex + 1}):`, await rubricRes.text());
          }
        } else {
          console.error(`[esignature/clicksign] positionedParties não tem e-mail correspondente a ${signatory.email}, assinatura posicionada pulada pra este signatário`);
        }
      }
    }

    const activateRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ data: { id: envelopeId, type: "envelopes", attributes: { status: "running" } } }),
    });
    if (!activateRes.ok) {
      const err = await activateRes.text();
      return { ok: false, error: `ClickSign activateEnvelope: ${err}`, status: 502 };
    }

    // Ativar o envelope (status: running) NÃO dispara o e-mail de assinatura
    // sozinho — a v3 exige a chamada explícita de notificação abaixo.
    const notifyRes = await notifyClickSignEnvelope(envelopeId, signatories[0]?.name ?? "", documentLabel, input.signatureMessage, input.signatureSubject);
    if (!notifyRes.ok) {
      console.error(`[esignature/clicksign] notifyEnvelope falhou para envelope ${envelopeId}: ${notifyRes.error}`);
    }

    return {
      ok: true,
      envelopeId,
      documentId,
      signUrl: `${baseUrl}/envelopes/${envelopeId}`,
      status: "PENDING",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

export async function getEnvelopeStatusV3(envelopeId: string): Promise<EnvelopeStatusResult> {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";
  if (!accessToken) return { ok: false, error: "CLICKSIGN_ACCESS_TOKEN não configurado", status: 500 };

  const headers = { Accept: "application/json", Authorization: accessToken };

  try {
    const envRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}`, { headers });
    if (!envRes.ok) {
      const err = await envRes.text();
      return { ok: false, error: `ClickSign getEnvelope: ${err}`, status: envRes.status };
    }
    const envData = await envRes.json();
    const status: string = envData.data?.attributes?.status ?? "desconhecido";

    let signedDocumentUrl: string | null = null;
    if (status === "closed" || status === "auto_closed") {
      const docsRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/documents`, { headers });
      if (docsRes.ok) {
        const docsData = await docsRes.json();
        signedDocumentUrl = docsData.data?.[0]?.links?.files?.signed ?? null;
      }
    }

    return { ok: true, status, signedDocumentUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

// Cancela um documento AINDA EM ABERTO (status running) dentro de um
// envelope v3. O cancelamento é no nível do DOCUMENTO, não do envelope —
// não existe endpoint de cancelamento de envelope na API v3.
export async function cancelClickSignDocument(envelopeId: string, documentId: string): Promise<CancelResult> {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";
  if (!accessToken) return { ok: false, error: "CLICKSIGN_ACCESS_TOKEN não configurado", status: 500 };

  try {
    const res = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/documents/${documentId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/vnd.api+json",
        Accept: "application/json",
        Authorization: accessToken,
      },
      body: JSON.stringify({
        data: { id: documentId, type: "documents", attributes: { status: "canceled" } },
      }),
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

// Fluxo v1 (legado, depreciado pelo ClickSign) — mantido só para "nda" e
// "mandato" até serem migrados também. O passo /finish está confirmadamente
// quebrado na conta de produção mesmo com documento+signatário vinculados
// corretamente; não investigar mais fundo, é bug da API depreciada.
async function sendToClickSignV1(input: SendEnvelopeInput): Promise<SendEnvelopeResult> {
  const { dealId, documentType, signatories, documentUrl: overrideUrl, documentLabel: overrideLabel } = input;

  if (!dealId || !documentType || !signatories?.length) {
    return { ok: false, error: "dealId, documentType e signatories são obrigatórios", status: 400 };
  }

  if (IS_DEMO) {
    return {
      ok: true,
      envelopeId: `DEMO-ENV-${Date.now()}`,
      documentId: null,
      signUrl: "https://app.clicksign.com/sign/demo",
      status: "PENDING",
    };
  }

  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";

  if (!accessToken) {
    return { ok: false, error: "CLICKSIGN_ACCESS_TOKEN não configurado", status: 500 };
  }

  try {
    const documentLabel =
      overrideLabel ??
      (documentType === "nda"
        ? `NDA, Deal ${dealId}`
        : documentType === "mandato"
        ? `Mandato M&A, Deal ${dealId}`
        : `Carta de Intenção, Deal ${dealId}`);

    const documentUrl =
      overrideUrl ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/ma/gerar-contrato?dealId=${dealId}&tipo=${documentType}&lang=pt-br`;

    const htmlRes = await fetch(documentUrl);
    if (!htmlRes.ok) {
      return { ok: false, error: `Falha ao buscar o conteúdo do documento em ${documentUrl}: HTTP ${htmlRes.status}`, status: 502 };
    }
    const html = await htmlRes.text();
    const contentBase64 = await htmlToPdfBase64(html);

    const createDocRes = await fetch(`${baseUrl}/api/v1/documents?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        document: {
          path: `/${documentLabel}.pdf`,
          content_base64: contentBase64,
          auto_close: true,
          locale: "pt-BR",
          remind_interval: 3,
        },
      }),
    });

    if (!createDocRes.ok) {
      const err = await createDocRes.text();
      return { ok: false, error: `ClickSign createDocument: ${err}`, status: 502 };
    }

    const docData = await createDocRes.json();
    const documentKey: string = docData.document?.key;

    for (const signatory of signatories) {
      const signerRes = await fetch(`${baseUrl}/api/v1/signers?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signer: {
            email: signatory.email,
            phone_number: null,
            auths: ["email"],
            name: signatory.name,
            has_documentation: false,
          },
        }),
      });
      if (!signerRes.ok) {
        const err = await signerRes.text();
        return { ok: false, error: `ClickSign createSigner (${signatory.email}): ${err}`, status: 502 };
      }
      const signerData = await signerRes.json();
      const signerKey: string = signerData.signer?.key;

      const listRes = await fetch(`${baseUrl}/api/v1/lists?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list: {
            document_key: documentKey,
            signer_key: signerKey,
            sign_as: "sign",
            refusable: true,
            message: `V3 Partners solicita sua assinatura no documento: ${documentLabel}`,
          },
        }),
      });
      if (!listRes.ok) {
        const err = await listRes.text();
        return { ok: false, error: `ClickSign addSignatory (${signatory.email}): ${err}`, status: 502 };
      }
    }

    const finishRes = await fetch(`${baseUrl}/api/v1/documents/${documentKey}/finish?access_token=${accessToken}`, { method: "PATCH" });
    if (!finishRes.ok) {
      const err = await finishRes.text();
      return { ok: false, error: `ClickSign finish: ${err}`, status: 502 };
    }

    return {
      ok: true,
      envelopeId: documentKey,
      documentId: null,
      signUrl: `${baseUrl}/sign/${documentKey}`,
      status: "PENDING",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

// Objeto que implementa ESignatureProvider. parseWebhookEvent NÃO é
// implementado nesta fase: app/api/ma/clicksign-webhook/route.ts continua
// com o parsing HMAC inline (não importa lib/clicksign.ts hoje, ficou fora
// do escopo aprovado dos 12 call sites desta extração). Migrar aquele
// parsing para cá é passo natural da Fase 2/3, não desta.
export const clickSignProvider: ESignatureProvider = {
  name: "clicksign",
  send: sendToClickSign,
  syncStatus: getEnvelopeStatusV3,
  cancel: (externalId, documentId) => cancelClickSignDocument(externalId, documentId ?? ""),
  notifyReminder: notifyClickSignEnvelope,
};
