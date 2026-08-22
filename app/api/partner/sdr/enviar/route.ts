import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — envio manual (operador do partner assumindo a conversa). Espelha
// /api/sdr/enviar, mas envia pela sessão OpenWA do próprio partner.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!PARTNER_ROLES.includes(profile?.role as typeof PARTNER_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();
  const { data: conexao } = await db
    .from("partner_sdr_connections")
    .select("addon_ativo, openwa_session_id")
    .eq("partner_id", user.id)
    .maybeSingle();
  if (!conexao?.addon_ativo) return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });
  if (!conexao.openwa_session_id) return NextResponse.json({ error: "WhatsApp ainda não conectado" }, { status: 400 });

  const { phone, text } = await req.json() as { phone: string; text: string };
  if (!phone || !text) return NextResponse.json({ error: "phone e text obrigatórios" }, { status: 400 });

  const sent = await sendText(phone, text, conexao.openwa_session_id);
  if (!sent) return NextResponse.json({ error: "Falha ao enviar via WhatsApp" }, { status: 500 });

  await db.from("sdr_conversas").insert({
    phone,
    partner_id: user.id,
    canal: "whatsapp",
    role: "assistant",
    content: `[${profile?.full_name ?? "Operador"}] ${text}`,
    instance: "openwa",
  });

  return NextResponse.json({ ok: true });
}
