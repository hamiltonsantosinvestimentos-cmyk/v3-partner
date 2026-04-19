import { NextRequest, NextResponse } from "next/server";

const IS_DEMO = false;

interface Signatory {
  name: string;
  email: string;
}

interface SendBody {
  dealId: string;
  documentType: "nda" | "mandato";
  signatories: Signatory[];
}

export async function POST(request: NextRequest) {
  let body: SendBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { dealId, documentType, signatories } = body;

  if (!dealId || !documentType || !signatories?.length) {
    return NextResponse.json(
      { error: "dealId, documentType e signatories são obrigatórios" },
      { status: 400 }
    );
  }

  // ─── DEMO ────────────────────────────────────────────────────────────────
  if (IS_DEMO) {
    return NextResponse.json({
      ok: true,
      envelopeId: `DEMO-ENV-${Date.now()}`,
      signUrl: "https://app.clicksign.com/sign/demo",
      status: "PENDING",
    });
  }

  // ─── PRODUÇÃO — ClickSign API v1 ─────────────────────────────────────────
  const accessToken = process.env.CLICKSIGN_ACCESS_TOKEN;
  const baseUrl =
    process.env.CLICKSIGN_BASE_URL ?? "https://sandbox.clicksign.com";

  if (!accessToken) {
    return NextResponse.json(
      { error: "CLICKSIGN_ACCESS_TOKEN não configurado" },
      { status: 500 }
    );
  }

  try {
    // 1. Cria o documento no ClickSign (upload via URL)
    const documentLabel =
      documentType === "nda"
        ? `NDA — Deal ${dealId}`
        : `Mandato M&A — Deal ${dealId}`;

    const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br"}/api/ma/gerar-contrato?dealId=${dealId}&tipo=${documentType}&lang=pt-br`;

    const createDocRes = await fetch(
      `${baseUrl}/api/v1/documents?access_token=${accessToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document: {
            path: `/${documentLabel}.html`,
            content_base64: null,
            auto_close: true,
            locale: "pt-BR",
            remind_interval: 3,
            url: documentUrl,
          },
        }),
      }
    );

    if (!createDocRes.ok) {
      const err = await createDocRes.text();
      return NextResponse.json(
        { error: `ClickSign createDocument: ${err}` },
        { status: 502 }
      );
    }

    const docData = await createDocRes.json();
    const documentKey: string = docData.document?.key;

    // 2. Adiciona signatários
    for (const signatory of signatories) {
      await fetch(
        `${baseUrl}/api/v1/lists?access_token=${accessToken}`,
        {
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
        }
      );
    }

    // 3. Ativa o documento (envia notificações aos signatários)
    await fetch(
      `${baseUrl}/api/v1/documents/${documentKey}/finish?access_token=${accessToken}`,
      { method: "PATCH" }
    );

    return NextResponse.json({
      ok: true,
      envelopeId: documentKey,
      signUrl: `${baseUrl}/sign/${documentKey}`,
      status: "PENDING",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
