import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ token: string }> };

// POST — registra evento de impressão do CIM com IP + timestamp
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;
  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent = req.headers.get("user-agent") ?? "";

  const body = await req.json().catch(() => ({}));
  const { doc_type = "cim", deal_id = "", deal_code = "", timestamp } = body;

  const db = svc();

  // Valida token
  const { data: invite } = await db
    .from("deal_room_invites")
    .select("id, investor_name, investor_email, investor_company, deal_rooms(id, deal_id)")
    .eq("token", token)
    .single();

  if (!invite) return NextResponse.json({ error: "Token inválido." }, { status: 404 });

  // Registra em document_views com status "printed"
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomDeal = (invite.deal_rooms as any)?.deal_id ?? deal_id;

  await db.from("document_views").insert({
    invite_id:   invite.id,
    document_id: null,         // impressão não é de um doc específico do room
    ip_address:  ipAddress,
    device_type: /mobile|android|iphone/i.test(userAgent) ? "mobile" : "desktop",
    status:      "printed",
    duration_seconds: 0,
  });

  // Log estruturado para auditoria
  console.log(JSON.stringify({
    event:          "cim_printed",
    investor_name:  invite.investor_name,
    investor_email: invite.investor_email,
    investor_company: invite.investor_company,
    deal_code,
    doc_type,
    ip_address:     ipAddress,
    token,
    timestamp:      timestamp ?? new Date().toISOString(),
  }));

  return NextResponse.json({ registered: true, investor: invite.investor_name });
}
