import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

type RouteContext = { params: Promise<{ token: string; doc_id: string }> };

// ── POST — obter URL assinada para documento ───────────────────────────────────
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { token, doc_id } = await ctx.params;

  const ipAddress  = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const userAgent  = req.headers.get("user-agent") ?? "";
  const deviceType = detectDevice(userAgent);

  const db = svc();

  // 1. Validar token e invite
  const { data: invite, error: invErr } = await db
    .from("deal_room_invites")
    .select("id, status, token_expires_at, deal_rooms(id)")
    .eq("token", token)
    .single();

  if (invErr || !invite) {
    return NextResponse.json({ error: "Token inválido." }, { status: 404 });
  }

  if (["revoked", "expired"].includes(invite.status)) {
    return NextResponse.json({ error: "Acesso revogado ou expirado." }, { status: 410 });
  }

  if (new Date(invite.token_expires_at) < new Date()) {
    return NextResponse.json({ error: "Link expirado." }, { status: 410 });
  }

  // 2. Buscar documento
  const { data: doc, error: docErr } = await db
    .from("deal_room_documents")
    .select("id, label, doc_type, storage_path, requires_nda, deal_room_id")
    .eq("id", doc_id)
    .single();

  if (docErr || !doc) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }

  // 3. Verificar se o documento pertence à sala correta
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roomId = (invite.deal_rooms as any)?.id;
  if (doc.deal_room_id !== roomId) {
    return NextResponse.json({ error: "Documento não pertence a esta sala." }, { status: 403 });
  }

  // 4. Verificar NDA se necessário
  if (doc.requires_nda) {
    const { data: ndaSig } = await db
      .from("nda_signatures")
      .select("id")
      .eq("invite_id", invite.id)
      .single();

    if (!ndaSig) {
      return NextResponse.json(
        { error: "Assine o NDA antes de acessar este documento.", requires_nda: true },
        { status: 403 }
      );
    }
  }

  // 5. Gerar URL assinada (1 hora)
  const { data: signedData, error: urlErr } = await db.storage
    .from("ma-documents")
    .createSignedUrl(doc.storage_path, 3600);

  if (urlErr || !signedData?.signedUrl) {
    return NextResponse.json({ error: "Erro ao gerar URL de acesso." }, { status: 500 });
  }

  // 6. Registrar visualização
  const { data: viewRecord } = await db
    .from("document_views")
    .insert({
      invite_id:   invite.id,
      document_id: doc.id,
      ip_address:  ipAddress,
      device_type: deviceType,
      status:      "opened",
    })
    .select("id")
    .single();

  // 7. Atualizar status do invite
  await db.from("deal_room_invites")
    .update({ status: "viewing" })
    .eq("id", invite.id);

  return NextResponse.json({
    url:         signedData.signedUrl,
    expires_in:  3600,
    view_id:     viewRecord?.id ?? null,
    doc_label:   doc.label,
    doc_type:    doc.doc_type,
  });
}

// ── PATCH — registrar duração de visualização ──────────────────────────────────
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { token, doc_id } = await ctx.params;

  const body = await req.json().catch(() => ({}));
  const { view_id, duration_seconds } = body;

  if (!view_id || typeof duration_seconds !== "number") {
    return NextResponse.json({ error: "view_id e duration_seconds obrigatórios." }, { status: 422 });
  }

  const db = svc();

  // Validar que o view_id pertence ao token
  const { data: invite } = await db
    .from("deal_room_invites")
    .select("id")
    .eq("token", token)
    .single();

  if (!invite) return NextResponse.json({ error: "Token inválido." }, { status: 404 });

  await db.from("document_views")
    .update({ duration_seconds, status: "closed" })
    .eq("id", view_id)
    .eq("invite_id", invite.id)  // segurança: só atualiza views do próprio invite
    .eq("document_id", doc_id);

  return NextResponse.json({ recorded: true, duration_seconds });
}

function detectDevice(ua: string): "mobile" | "desktop" | "tablet" {
  if (/tablet|ipad/i.test(ua)) return "tablet";
  if (/mobile|android|iphone/i.test(ua)) return "mobile";
  return "desktop";
}
