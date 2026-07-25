export interface ClickSignSignatory {
  name: string;
  email: string;
}

export interface SendToClickSignInput {
  dealId: string;
  documentType: "nda" | "mandato" | "loi";
  signatories: ClickSignSignatory[];
  documentUrl?: string;
  documentLabel?: string;
}

export type SendToClickSignResult =
  | { ok: true; envelopeId: string; signUrl: string; status: "PENDING" }
  | { ok: false; error: string; status: number };

const IS_DEMO = false;

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
async function htmlToPdfBase64(html: string): Promise<string> {
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
  if (input.documentType === "loi") {
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
    const documentUrl =
      overrideUrl ??
      `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/ma/gerar-contrato?dealId=${dealId}&tipo=${documentType}&lang=pt-br`;

    const htmlRes = await fetch(documentUrl);
    if (!htmlRes.ok) {
      return { ok: false, error: `Falha ao buscar o conteúdo do documento em ${documentUrl}: HTTP ${htmlRes.status}`, status: 502 };
    }
    const html = await htmlRes.text();
    const contentBase64 = await htmlToPdfBase64(html);

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
    const notifyRes = await fetch(`${baseUrl}/api/v3/envelopes/${envelopeId}/notifications`, {
      method: "POST",
      headers,
      body: JSON.stringify({ data: { type: "notifications", attributes: { message: null } } }),
    });
    if (!notifyRes.ok) {
      const err = await notifyRes.text();
      console.error(`[clicksign] notifyEnvelope falhou para envelope ${envelopeId}: ${err}`);
    }

    return {
      ok: true,
      envelopeId,
      signUrl: `${baseUrl}/envelopes/${envelopeId}`,
      status: "PENDING",
    };
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
      signUrl: `${baseUrl}/sign/${documentKey}`,
      status: "PENDING",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return { ok: false, error: message, status: 500 };
  }
}
