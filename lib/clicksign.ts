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

    const createDocRes = await fetch(`${baseUrl}/api/v1/documents?access_token=${accessToken}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // content_base64 nao pode ser enviado (nem como null) quando o
      // documento vem de uma url: o ClickSign valida o campo presente no
      // payload como base64 real e rejeita com "Conteudo do Base64 invalido".
      body: JSON.stringify({
        document: {
          path: `/${documentLabel}.html`,
          auto_close: true,
          locale: "pt-BR",
          remind_interval: 3,
          url: documentUrl,
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
      await fetch(`${baseUrl}/api/v1/lists?access_token=${accessToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          list: {
            document_key: documentKey,
            signer: {
              email: signatory.email,
              phone_number: null,
              auth_type: "email",
              name: signatory.name,
              has_documentation: false,
            },
            sign_as: "sign",
            message: `V3 Partners solicita sua assinatura no documento: ${documentLabel}`,
          },
        }),
      });
    }

    await fetch(`${baseUrl}/api/v1/documents/${documentKey}/finish?access_token=${accessToken}`, { method: "PATCH" });

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
