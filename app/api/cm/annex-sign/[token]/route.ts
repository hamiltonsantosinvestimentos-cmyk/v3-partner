import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const format = req.nextUrl.searchParams.get("format");

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("id, contract_title, rendered_html, status_signature, signed_at, parties, vertical, external_envelope_id")
    .eq("signing_token", token)
    .single();

  if (!contract) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  // format=html serve o HTML puro do contrato para o ClickSign buscar como
  // document.url (fluxo de assinatura digital real, ex: Carta de Intenção).
  if (format === "html") {
    return new NextResponse(contract.rendered_html ?? "", {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return NextResponse.json({ contract });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("id, rendered_html, status_signature, vertical")
    .eq("signing_token", token)
    .single();

  if (!contract) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  // Contratos vertical "ma" (ex: Carta de Intenção) exigem assinatura digital
  // real via ClickSign, gravada pelo webhook (clicksign-webhook), nunca pelo
  // clique+hash simples usado no Anexo FPA/NCND (vertical capital_markets).
  if (contract.vertical === "ma") {
    return NextResponse.json(
      { error: "Este documento requer assinatura digital via ClickSign, não pode ser assinado por este link." },
      { status: 400 }
    );
  }

  if (contract.status_signature === "assinado")
    return NextResponse.json({ success: true, message: "Anexo já assinado" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const timestamp = new Date().toISOString();

  const hashPayload = `${contract.id}|${token}|${ip}|${userAgent}|${timestamp}|anexo_assinado|${contract.rendered_html}`;
  const signatureHash = createHash("sha256").update(hashPayload).digest("hex");

  const { error } = await svc()
    .from("operation_contracts")
    .update({
      status_signature: "assinado",
      signed_at: timestamp,
      signature_hash: signatureHash,
    })
    .eq("id", contract.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, signed_at: timestamp, signature_hash: signatureHash });
}
