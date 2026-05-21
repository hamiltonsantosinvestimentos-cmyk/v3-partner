import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RouteContext = { params: Promise<{ token: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  if (body.agreed !== true) {
    return NextResponse.json({ error: "Aceite obrigatório: { agreed: true }" }, { status: 422 });
  }

  const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
                 ?? req.headers.get("x-real-ip")
                 ?? "unknown";
  const userAgent  = req.headers.get("user-agent") ?? "";

  const db = svc();

  // Validar token
  const { data: invite, error } = await db
    .from("deal_room_invites")
    .select("id, status, token_expires_at, deal_rooms(nda_text)")
    .eq("token", token)
    .single();

  if (error || !invite) {
    return NextResponse.json({ error: "Token inválido." }, { status: 404 });
  }

  if (invite.status === "revoked") {
    return NextResponse.json({ error: "Link revogado." }, { status: 410 });
  }

  if (new Date(invite.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 410 });
  }

  // Verificar se já assinou
  const { data: existing } = await db
    .from("nda_signatures")
    .select("id")
    .eq("invite_id", invite.id)
    .single();

  if (existing) {
    return NextResponse.json({ already_signed: true, message: "NDA já registrado." });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ndaText = (invite.deal_rooms as any)?.nda_text ?? "Texto padrão NDA V3 Partners v1.0";

  // Registrar assinatura
  const { error: sigErr } = await db.from("nda_signatures").insert({
    invite_id:   invite.id,
    ip_address:  ipAddress,
    user_agent:  userAgent,
    agreed_text: ndaText,
  });

  if (sigErr) {
    return NextResponse.json({ error: "Erro ao registrar assinatura." }, { status: 500 });
  }

  // Atualizar status do convite
  await db.from("deal_room_invites")
    .update({ status: "nda_signed" })
    .eq("id", invite.id);

  return NextResponse.json({
    signed: true,
    signed_at: new Date().toISOString(),
    ip_recorded: ipAddress,
    message: "NDA registrado com sucesso. Acesso liberado.",
  });
}
