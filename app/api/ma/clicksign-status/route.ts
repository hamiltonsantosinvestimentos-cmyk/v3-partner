import { NextRequest, NextResponse } from "next/server";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const envelopeId = searchParams.get("envelopeId");

  if (!envelopeId) {
    return NextResponse.json(
      { error: "envelopeId obrigatório" },
      { status: 400 }
    );
  }

  // ─── DEMO ────────────────────────────────────────────────────────────────
  if (IS_DEMO || envelopeId.startsWith("DEMO-ENV-")) {
    return NextResponse.json({
      status: "PENDING",
      envelopeId,
      signatories: [
        {
          name: "Representante Legal do Ativo",
          email: "contato@empresa.com.br",
          signed: false,
          signedAt: null,
        },
      ],
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
    const res = await fetch(
      `${baseUrl}/api/v1/documents/${envelopeId}?access_token=${accessToken}`,
      { method: "GET" }
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `ClickSign getDocument: ${err}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const doc = data.document;

    // Normaliza status ClickSign → status interno
    let status: "PENDING" | "SIGNED" | "EXPIRED" = "PENDING";
    if (doc.status === "closed") status = "SIGNED";
    else if (doc.status === "canceled") status = "EXPIRED";

    // Mapeia os signatários
    const signatories = (doc.signers ?? []).map(
      (s: { name?: string; email?: string; signed?: boolean; signed_at?: string }) => ({
        name: s.name ?? "—",
        email: s.email ?? "—",
        signed: s.signed ?? false,
        signedAt: s.signed_at ?? null,
      })
    );

    return NextResponse.json({
      status,
      envelopeId,
      documentKey: doc.key,
      documentStatus: doc.status,
      signatories,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
