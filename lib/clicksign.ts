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

// Dispara um documento para assinatura digital real na API v1 do ClickSign.
// Usado tanto pela rota autenticada (app/api/ma/clicksign-send, UI da Mesa)
// quanto por fluxos públicos server-to-server (ex: intake da Carta de
// Intenção): nesses últimos, chamar esta função diretamente, nunca via
// fetch HTTP para a rota, que fica atrás do gate de auth do proxy.ts.
export async function sendToClickSign(input: SendToClickSignInput): Promise<SendToClickSignResult> {
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
