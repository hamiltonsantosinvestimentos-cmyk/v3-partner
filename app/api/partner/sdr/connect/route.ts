import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { createSession, getSessionStatus, getSessionQr } from "@/lib/whatsapp/openwa-client";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authGuard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) return null;
  return { user };
}

// GET — status da conexão WhatsApp do partner (QR / conectado / desconectado).
// Espelha /api/sdr/qrcode, mas resolvendo a sessão do partner em vez da sessão
// global da V3 — status é sempre consultado ao vivo no OpenWA, nunca cacheado.
export async function GET() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: conexao } = await db
    .from("partner_sdr_connections")
    .select("openwa_session_id, addon_ativo")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  if (!conexao?.addon_ativo) {
    return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });
  }
  if (!conexao.openwa_session_id) {
    return NextResponse.json({ qrcode: null, status: "desconectado" });
  }

  try {
    const session = await getSessionStatus(conexao.openwa_session_id);

    if (session.status === "ready") {
      await db.from("partner_sdr_connections").update({
        status: "conectado", whatsapp_phone: session.phone, updated_at: new Date().toISOString(),
      }).eq("partner_id", auth.user.id);
      return NextResponse.json({ qrcode: null, status: "conectado", phone: session.phone, pushName: session.pushName });
    }

    if (session.status === "qr_ready") {
      const qrcode = await getSessionQr(conexao.openwa_session_id);
      return NextResponse.json({ qrcode, status: "aguardando_qr" });
    }

    return NextResponse.json({ qrcode: null, status: "desconectado", error: session.lastError });
  } catch (e) {
    return NextResponse.json({ qrcode: null, status: "desconectado", error: String(e) });
  }
}

// POST — provisiona a sessão OpenWA do partner (uma vez só; se já existe, é
// no-op). A V3 continua sendo a única dona da OPENWA_API_KEY — o partner
// nunca vê essa chave, só o QR da própria sessão criada aqui.
export async function POST() {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: conexao } = await db
    .from("partner_sdr_connections")
    .select("openwa_session_id, addon_ativo")
    .eq("partner_id", auth.user.id)
    .maybeSingle();

  if (!conexao?.addon_ativo) {
    return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });
  }
  if (conexao.openwa_session_id) {
    return NextResponse.json({ ok: true, sessionId: conexao.openwa_session_id });
  }

  try {
    const sessionId = await createSession(`partner-${auth.user.id}`);
    await db.from("partner_sdr_connections").upsert({
      partner_id: auth.user.id,
      openwa_session_id: sessionId,
      status: "aguardando_qr",
      updated_at: new Date().toISOString(),
    }, { onConflict: "partner_id" });
    return NextResponse.json({ ok: true, sessionId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao criar sessão" }, { status: 500 });
  }
}
