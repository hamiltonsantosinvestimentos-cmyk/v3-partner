import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { sendInstagramText } from "@/lib/instagram-dm";
import { sendMessengerText } from "@/lib/messenger-dm";
import { sendTelegramText } from "@/lib/telegram-dm";
import { formatQuickReplyBlock, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";
import { SDR_INTERNO_PARTNER_ID, type SdrCanal } from "@/lib/sdr-agent";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "SDR", "CLOSER"] as const;
const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  const { phone, text, quickReplyOptions } = await req.json() as {
    phone: string; text: string; quickReplyOptions?: QuickReplyOption[];
  };
  if (!phone || !text) return NextResponse.json({ error: "phone e text obrigatórios" }, { status: 400 });

  const { data: lead } = await svc().from("sdr_leads").select("canal, responsavel_id").eq("phone", phone).eq("partner_id", SDR_INTERNO_PARTNER_ID).maybeSingle();
  if (!isAdmin && lead?.responsavel_id && lead.responsavel_id !== user.id) {
    return NextResponse.json({ error: "Esse lead já tem outro responsável" }, { status: 403 });
  }
  const canal = (lead?.canal ?? "whatsapp") as SdrCanal;

  // Opções de resposta rápida simuladas por texto — mesmo método nos 4 canais
  // (ver comentário em lib/sdr-agent.ts sobre OFERTA_QUALIFICADO).
  const textoFinal = quickReplyOptions?.length
    ? `${text}\n\n${formatQuickReplyBlock(quickReplyOptions)}`
    : text;

  const ENVIO_POR_CANAL: Record<SdrCanal, (texto: string) => Promise<void>> = {
    whatsapp: async (texto) => {
      const sent = await sendText(phone, texto);
      if (!sent) throw new Error("Falha ao enviar via OpenWA");
    },
    instagram: (texto) => sendInstagramText(phone, texto),
    messenger: (texto) => sendMessengerText(phone, texto),
    telegram: (texto) => sendTelegramText(phone, texto),
  };

  try {
    await ENVIO_POR_CANAL[canal](textoFinal);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : `Falha ao enviar via ${canal}` }, { status: 500 });
  }

  const INSTANCE_POR_CANAL: Record<SdrCanal, string> = {
    whatsapp: "openwa", instagram: "instagram", messenger: "messenger", telegram: "telegram",
  };

  // Salva no histórico como assistant (mas marcado como humano)
  await svc().from("sdr_conversas").insert({
    phone,
    canal,
    role: "assistant",
    content: `[${profile?.full_name ?? "Operador"}] ${textoFinal}`,
    instance: INSTANCE_POR_CANAL[canal],
    quick_reply_options: quickReplyOptions?.length ? quickReplyOptions : null,
  });

  return NextResponse.json({ ok: true });
}
