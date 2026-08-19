import { auditText } from "@/lib/brand-guardian-gate";

export interface ClickSignSignatory {
  name: string;
  email: string;
}

export interface SendToClickSignInput {
  dealId: string;
  documentType: "nda" | "mandato" | "loi" | "contrato_venda" | "fpa_venda" | "fpa_compra" | "nda_quadripartite" | "contrato_final";
  signatories: ClickSignSignatory[];
  documentUrl?: string;
  documentLabel?: string;
  // Observador de Assinatura (11/08/2026, ciclo ClickSign Fase 2): quando
  // informado, a V3 é cadastrada como signature_watcher do envelope com
  // attach_documents_enabled=true — a ClickSign envia o PDF final assinado
  // por e-mail para este endereço sozinha, sem necessidade de endpoint de
  // download (não confirmado existir na API v3, ver lib/clicksign.ts nota
  // em sendToClickSignV3). Opcional: nem todo caller precisa disso hoje.
  watcherEmail?: string;
  // Mensagem customizada (19/08/2026, item 4 dos ajustes de governança
  // pedidos por João, série V3C-REG): substitui o parágrafo principal do
  // e-mail de convite de assinatura (attributes.email_customization.principal
  // em POST /envelopes/{id}/notifications, mesmo endpoint real já usado por
  // notifyClickSignEnvelope, endpoint e payload confirmados ao vivo contra a
  // conta de produção em 11/08/2026, não é novo). Passa pelo mesmo gate
  // auditText() do texto padrão: nenhum texto para o signatário sai sem
  // essa revisão, mesmo padrão que corrigiu o P0 de 11/08.
  signatureMessage?: string;
  // Par de signatureMessage: assunto customizado do e-mail (attributes.
  // email_customization.subject), mesmo mecanismo, mesmo gate auditText().
  signatureSubject?: string;
  // 19/08/2026, regularização de contrato manual (série V3C-REG): quando
  // presente, pula o fetch(documentUrl)+htmlToPdfBase64 e usa este PDF já
  // pronto (capa Termo + original mesclados e estampados, ver
  // lib/contract-watermark.ts) como content_base64 do documento. Precisa
  // vir no formato "data:application/pdf;base64,...", igual ao que
  // htmlToPdfBase64 já produz.
  documentContentBase64?: string;
}

// documentTypes que usam a API v3 (envelopes), confirmadamente funcional.
// "nda" continua na v1 depreciada (fluxo M&A original, não tocado aqui).
// "mandato" migrado para v3 nesta extensão (2026-07-28, botão "Enviar para
// Assinatura" da Central de Contratos): não tinha nenhum caller real até
// então, então mover para o caminho funcional não muda comportamento de
// produção nenhum. "nda_quadripartite" e "contrato_final" são os novos
// tipos da esteira de qualificação de partes da Bolsa de Capitais.
const V3_DOCUMENT_TYPES = new Set(["loi", "contrato_venda", "fpa_venda", "fpa_compra", "mandato", "nda_quadripartite", "contrato_final"]);

export type SendToClickSignResult =
  | { ok: true; envelopeId: string; documentId: string | null; signUrl: string; status: "PENDING" }
  | { ok: false; error: string; status: number };

const IS_DEMO = false;

export type NotifyClickSignResult = { ok: true } | { ok: false; error: string; status: number };

// Notifica o(s) signatário(s) de um envelope v3 já ativo (envia/reenvia o
// e-mail de assinatura). Extraído de sendToClickSignV3 para ser reutilizável
// pelo botão "Reenviar notificação" do painel de acompanhamento, sem
// duplicar a copy já aprovada pelo brand-guardian em dois lugares.
//
// P0 REAL achado 11/08/2026 (não por mim, por João, lendo o e-mail de
// verdade que o Robson e o Hamilton receberam): esta função tinha o texto
// "Carta de Intenção de Compra" FIXO no assunto e no corpo, escrito
// originalmente só para o fluxo de LOI (M&A) e nunca adaptado quando outros
// 6 documentTypes passaram a chamar sendToClickSignV3. Os 2 contratos reais
// de hoje (Closer, Home Cash) saíram com e-mail dizendo "Carta de Intenção
// de Compra" quando não são isso. Eu nunca tinha checado o TEXTO do e-mail,
// só se o envio retornava 200 — confirmar envio não é confirmar conteúdo.
// documentLabel agora é obrigatório, para nenhum caller poder esquecer de
// passar o contexto real do documento.
// Gate Brand & Grammar Guardian (11/08/2026, ciclo ClickSign): esta função já
// levou um P0 real por texto fixo indo pro signatário sem revisão de
// conteúdo (ver comentário acima). auditText() roda em processo, sem n8n,
// mesmo padrão já usado por notifyFpaVendaDisponivel/sendNdaCopyByEmail —
// nunca bloqueia o envio (nenhum check de auditText é blocking hoje), só
// corrige travessão/emoji/acentuação/menção a Bloxs antes do payload sair
// para a API do ClickSign, que dispara o e-mail sozinha.
export async function notifyClickSignEnvelope(envelopeId: string, signatoryName: string, documentLabel: string, customMessage?: string, customSubject?: string): Promise<NotifyClickSignResult> {
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl = process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";
  if (!accessToken) return { ok: false, error: "CLICKSIGN_ACCESS_TOKEN não configurado", status: 500 };

  const safeLabel = auditText(documentLabel).corrected;
  const safeName = auditText(signatoryName || "Sr(a)").corrected;
  const subject = customSubject
    ? auditText(customSubject).corrected
    : auditText(`V3 Partners: Assinatura Digital, ${safeLabel}`).corrected;
  // 19/08/2026: quando vem mensagem customizada (série V3C-REG), o texto já
  // traz a própria saudação embutida ("Prezado(a) Parceiro(a),"), então a
  // saudação separada é suprimida para não duplicar ("Prezado(a) Fulano,"
  // seguido de "Prezado(a) Parceiro(a),").
  const greeting = customMessage ? "" : auditText(`Prezado(a) ${safeName},`).corrected;
  // 19/08/2026: quando o caller passa uma mensagem customizada (série
  // V3C-REG, "isso é uma revalidação/integração ao sistema V3"), ela
  // substitui o parágrafo padrão, passando pelo mesmo gate auditText().
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
// vivo: HTML retorna "Documento deve ser em formato pdf, Word (doc e docx),
// Imagens (png ou jpeg) ou Texto (txt)"), então todo HTML precisa virar PDF
// antes de subir. Mesmo padrão de launch do Puppeteer usado em cim-pdf.
// Exportado em 19/08/2026 para reuso por app/api/contracts/manual-intake
// (item 4 dos ajustes de governança): o mesmo Puppeteer/Chromium já
// homologado aqui, sem duplicar a lógica de launch (production vs local).
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
// Usado tanto pela rota autenticada (app/api/ma/clicksign-send, UI da Mesa)
// quanto por fluxos públicos server-to-server (ex: intake da Carta de
// Intenção): nesses últimos, chamar esta função diretamente, nunca via
// fetch HTTP para a rota, que fica atrás do gate de auth do proxy.ts.
//
// documentType "loi" usa a API v3 (envelopes) — a v1 está oficialmente
// depreciada (header "Warning: 299 app.clicksign.com API depreciada."
// confirmado ao vivo) e seu passo final (/documents/{key}/finish) está
// quebrado mesmo com documento+signatário corretamente vinculados. "nda" e
// "mandato" continuam na v1 por enquanto (nenhum dos dois foi testado nesta
// migração; migrar os três de uma vez triplicaria a superfície de teste).
export async function sendToClickSign(input: SendToClickSignInput): Promise<SendToClickSignResult> {
  if (V3_DOCUMENT_TYPES.has(input.documentType)) {
    return sendToClickSignV3(input);
  }
  return sendToClickSignV1(input);
}

// Fluxo v3 (envelopes), confirmado ponta a ponta contra a conta de produção
// real: criar envelope → upload documento → criar signatário → 2 requisitos
// (agree/sign = consentimento de assinatura, provide_evidence/email =
// autenticação) → ativar (status: running, dispara o e-mail real). Todos os
// 5 passos testados com HTTP 200/201 reais antes desta função existir.
//
// Autenticação: header "Authorization: <token>" (sem prefixo "Bearer",
// confirmado ao vivo — access_token como query param também funciona, mas
// o header é o padrão real da v3).
//
// Achado só visível em teste real, não documentado: o campo "name" do
// signatário rejeita dígitos (retorna 400 "name não está em um formato
// válido"). Nomes reais de compradores não deveriam esbarrar nisso, mas o
// erro do ClickSign já é claro o suficiente pra propagar direto.
async function sendToClickSignV3(input: SendToClickSignInput): Promise<SendToClickSignResult> {
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

    // Regularização de contrato manual (19/08/2026): o PDF já vem pronto
    // (capa + original mesclados e estampados), pula o fetch+conversão.
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
    const envelopeData = await envelopeRes.json();
    const envelopeId: string = envelopeData.data?.id;

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
    const docData = await docRes.json();
    const documentId: string = docData.data?.id;

    // Observador de Assinatura (11/08/2026): best-effort, nunca falha o envio
    // inteiro por causa disso. attach_documents_enabled faz a ClickSign
    // mandar o PDF final assinado por e-mail sozinha quando o envelope
    // fecha, endpoint e payload confirmados na documentação oficial
    // (developers.clicksign.com/v3.0/reference/api-criar-observadores).
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
        console.error(`[clicksign] falha ao cadastrar observador (${input.watcherEmail}) no envelope ${envelopeId}:`, await watcherRes.text());
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
    // sozinho — confirmado ao vivo (envelope ativado com sucesso, e-mail
    // nunca chegou). A v3 exige a chamada explícita de notificação abaixo.
    // Falha aqui não desfaz o envio: o envelope já está ativo e assinável
    // pelo link; só o lembrete automático (remind_interval) cobriria o
    // signatário eventualmente, então logamos em vez de falhar a operação
    // inteira por um problema de notificação.
    const notifyRes = await notifyClickSignEnvelope(envelopeId, signatories[0]?.name ?? "", documentLabel, input.signatureMessage, input.signatureSubject);
    if (!notifyRes.ok) {
      console.error(`[clicksign] notifyEnvelope falhou para envelope ${envelopeId}: ${notifyRes.error}`);
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

export type EnvelopeStatusV3Result =
  | {
      ok: true;
      status: string; // "running" | "closed" | "canceled" | outro valor real da ClickSign
      signedDocumentUrl: string | null; // presigned S3, TTL curto (~5min): baixar na hora, nunca guardar a URL
    }
  | { ok: false; error: string; status: number };

// Sincronização real de status por envelope (19/08/2026, item 2 dos ajustes
// de governança pedidos por João, disparado por n8n a cada 30min via
// GET /api/cron/clicksign-sync, não por cron da Vercel). Confirmado ao vivo
// contra os 2 envelopes reais de parceria em 19/08/2026: GET
// /envelopes/{id} retorna status real ("closed" para V3C-PAR-2026-0037,
// assinado por todos e nunca refletido no portal por falha do webhook;
// "running" para V3C-PAR-2026-0038, ainda pendente). GET
// /envelopes/{id}/documents retorna, quando fechado, um link presigned S3
// em data[0].links.files.signed. CORRIGE a suposição da migration
// 20260814, que afirmava não existir esse endpoint (não tinha sido testado
// ao vivo até agora, só pesquisado em documentação).
export async function getEnvelopeStatusV3(envelopeId: string): Promise<EnvelopeStatusV3Result> {
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
      // Falha ao buscar o PDF assinado não derruba a sincronização de status:
      // o poller de e-mail (lib/clicksign-archive.ts) continua como
      // segunda chance de arquivar o documento.
    }

    return { ok: true, status, signedDocumentUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}

export type CancelClickSignDocumentResult = { ok: true } | { ok: false; error: string; status: number };

// Cancela um documento AINDA EM ABERTO (status running) dentro de um
// envelope v3. Usado por PATCH /api/contracts/[id]/edit-body (11/08/2026,
// ciclo ClickSign Fase 1) para invalidar o link de assinatura antigo antes
// de reenviar um contrato editado, evitando que o signatário assine a
// versão desatualizada. Endpoint e payload confirmados na documentação
// oficial (developers.clicksign.com/reference/editar-documento): o
// cancelamento é no nível do DOCUMENTO, não do envelope — não existe
// endpoint de cancelamento de envelope na API v3. Retorna erro (não lança)
// se o documento já estiver finalizado (422 esperado da ClickSign nesse
// caso) — quem chama decide se isso bloqueia ou só avisa.
export async function cancelClickSignDocument(envelopeId: string, documentId: string): Promise<CancelClickSignDocumentResult> {
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
async function sendToClickSignV1(input: SendToClickSignInput): Promise<SendToClickSignResult> {
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
    // documentType "loi" (e qualquer outro que informe documentUrl) usa o HTML
    // já renderizado em operation_contracts, servido por annex-sign?format=html.
    // "nda"/"mandato" seguem o caminho original: HTML gerado sob demanda a
    // partir de ma_deals via /api/ma/gerar-contrato.
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

    // A API v1 do ClickSign não aceita criar documento a partir de uma url,
    // só content_base64 no formato "data:<mimetype>;base64,<dados>", e o
    // formato precisa ser PDF/Word/imagem/TXT, nunca HTML (os dois confirmados
    // ao vivo contra a conta de produção). Busca o HTML, renderiza como PDF
    // via Puppeteer, e só então sobe o base64.
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
      // A API v1 exige o signatário já existir como recurso próprio (signer_key)
      // antes de vincular ao documento em /api/v1/lists — mandar os dados do
      // signatário direto ali (sem criar antes) retorna "Signatário não
      // encontrado", confirmado ao vivo contra a conta de produção.
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
      documentId: null, // v1 (legado) não tem o cancelamento de documento da v3, ver cancelClickSignDocument
      signUrl: `${baseUrl}/sign/${documentKey}`,
      status: "PENDING",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}
