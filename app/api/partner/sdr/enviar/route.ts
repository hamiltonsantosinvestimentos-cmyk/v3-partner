import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { sendInstagramTextAsPage } from "@/lib/instagram-dm";
import { sendMessengerText } from "@/lib/messenger-dm";
import { sendTelegramText } from "@/lib/telegram-dm";
import { decryptPageToken } from "@/lib/meta-oauth";
import { decryptSecret } from "@/lib/crypto/secret";
import { formatQuickReplyBlock, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import type { SdrCanal } from "@/lib/sdr-agent";

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — envio manual (operador do partner assumindo a conversa). Espelha
// /api/sdr/enviar, mas cada canal usa a conexão própria do partner
// (partner_sdr_connections), nunca a credencial interna da V3.
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
    .select("addon_ativo, openwa_session_id, meta_page_id, meta_page_access_token_encrypted, instagram_business_account_id, telegram_bot_token_encrypted")
    .eq("partner_id", user.id)
    .maybeSingle();
  if (!conexao?.addon_ativo) return NextResponse.json({ error: "Add-on não contratado" }, { status: 403 });

  const { phone, text, quickReplyOptions } = await req.json() as {
    phone: string; text: string; quickReplyOptions?: QuickReplyOption[];
  };
  if (!phone || !text) return NextResponse.json({ error: "phone e text obrigatórios" }, { status: 400 });

  const { data: lead } = await db.from("sdr_leads").select("canal").eq("phone", phone).eq("partner_id", user.id).maybeSingle();
  const canal = (lead?.canal ?? "whatsapp") as SdrCanal;

  // Opções de resposta rápida simuladas por texto — mesmo método nos 4 canais
  // (ver comentário em lib/sdr-agent.ts sobre OFERTA_QUALIFICADO).
  const textoFinal = quickReplyOptions?.length
    ? `${text}\n\n${formatQuickReplyBlock(quickReplyOptions)}`
    : text;

  try {
    if (canal === "whatsapp") {
      if (!conexao.openwa_session_id) throw new Error("WhatsApp ainda não conectado");
      const sent = await sendText(phone, textoFinal, conexao.openwa_session_id);
      if (!sent) throw new Error("Falha ao enviar via WhatsApp");
    } else if (canal === "instagram") {
      if (!conexao.meta_page_access_token_encrypted || !conexao.instagram_business_account_id) throw new Error("Instagram ainda não conectado");
      await sendInstagramTextAsPage(conexao.instagram_business_account_id, phone, textoFinal, decryptPageToken(conexao.meta_page_access_token_encrypted));
    } else if (canal === "messenger") {
      if (!conexao.meta_page_access_token_encrypted) throw new Error("Messenger ainda não conectado");
      await sendMessengerText(phone, textoFinal, decryptPageToken(conexao.meta_page_access_token_encrypted));
    } else if (canal === "telegram") {
      if (!conexao.telegram_bot_token_encrypted) throw new Error("Telegram ainda não conectado");
      await sendTelegramText(phone, textoFinal, decryptSecret(conexao.telegram_bot_token_encrypted));
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : `Falha ao enviar via ${canal}` }, { status: 500 });
  }

  const INSTANCE_POR_CANAL: Record<SdrCanal, string> = {
    whatsapp: "openwa", instagram: "instagram", messenger: "messenger", telegram: "telegram",
  };

  await db.from("sdr_conversas").insert({
    phone,
    partner_id: user.id,
    canal,
    role: "assistant",
    content: `[${profile?.full_name ?? "Operador"}] ${textoFinal}`,
    instance: INSTANCE_POR_CANAL[canal],
    quick_reply_options: quickReplyOptions?.length ? quickReplyOptions : null,
  });

  return NextResponse.json({ ok: true });
}
