import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("id, contract_title, rendered_html, status_signature, signed_at, parties")
    .eq("signing_token", token)
    .single();

  if (!contract) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

  return NextResponse.json({ contract });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("id, rendered_html, status_signature")
    .eq("signing_token", token)
    .single();

  if (!contract) return NextResponse.json({ error: "Link inválido" }, { status: 404 });

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
