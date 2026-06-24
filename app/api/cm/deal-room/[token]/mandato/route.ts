import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createHash } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const { data: access } = await svc()
    .from("cm_deal_room_access")
    .select("id, nda_accepted, access_tier, qualification_status, mandato_v3_accepted, revoked, expires_at")
    .eq("access_token", token)
    .single();

  if (!access || access.revoked)
    return NextResponse.json({ error: "Link inválido ou revogado" }, { status: 404 });

  if (access.expires_at && new Date(access.expires_at) < new Date())
    return NextResponse.json({ error: "Link expirado" }, { status: 410 });

  if (!access.nda_accepted)
    return NextResponse.json({ error: "NDA precisa ser aceito primeiro" }, { status: 422 });

  if (access.access_tier !== "qualified" || access.qualification_status !== "aprovado")
    return NextResponse.json({ error: "Qualificação precisa ser aprovada antes do mandato" }, { status: 422 });

  if (access.mandato_v3_accepted)
    return NextResponse.json({ success: true, message: "Mandato V3 já aceito" });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";
  const timestamp = new Date().toISOString();
  const geo = req.headers.get("cf-ipcountry") ?? req.headers.get("x-vercel-ip-country") ?? null;

  const hashPayload = `${access.id}|${token}|${ip}|${userAgent}|${timestamp}|mandato_v3_accepted`;
  const mandatoHash = createHash("sha256").update(hashPayload).digest("hex");

  const { error } = await svc()
    .from("cm_deal_room_access")
    .update({
      mandato_v3_accepted: true,
      mandato_v3_accepted_at: timestamp,
      mandato_v3_hash: mandatoHash,
      access_tier: "full_dd",
    })
    .eq("id", access.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    success: true,
    message: "Mandato V3 aceito. Acesso completo liberado.",
    mandato_hash: mandatoHash,
  });
}
