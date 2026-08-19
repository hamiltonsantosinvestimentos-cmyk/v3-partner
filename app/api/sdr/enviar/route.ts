import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { sendInstagramText } from "@/lib/instagram-dm";
import { formatQuickReplyBlock, type QuickReplyOption } from "@/lib/whatsapp/quick-reply";

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

  const { data: lead } = await svc().from("sdr_leads").select("canal, responsavel_id").eq("phone", phone).maybeSingle();
  if (!isAdmin && lead?.responsavel_id && lead.responsavel_id !== user.id) {
    return NextResponse.json({ error: "Esse lead já tem outro responsável" }, { status: 403 });
  }
  const canal = lead?.canal ?? "whatsapp";

  // Opções de resposta rápida simulado por texto é um hack específico do WhatsApp (a API
  // não oficial não permite botão nativo) — Instagram tem quick replies nativos da própria
  // API, ainda não implementados aqui, então nunca anexa o bloco nesse canal.
  const textoFinal = canal === "whatsapp" && quickReplyOptions?.length
    ? `${text}\n\n${formatQuickReplyBlock(quickReplyOptions)}`
    : text;

  if (canal === "instagram") {
    try {
      await sendInstagramText(phone, textoFinal);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao enviar via Instagram" }, { status: 500 });
    }
  } else {
    const sent = await sendText(phone, textoFinal);
    if (!sent) {
      return NextResponse.json({ error: "Falha ao enviar via OpenWA" }, { status: 500 });
    }
  }

  // Salva no histórico como assistant (mas marcado como humano)
  await svc().from("sdr_conversas").insert({
    phone,
    canal,
    role: "assistant",
    content: `[${profile?.full_name ?? "Operador"}] ${textoFinal}`,
    instance: canal === "instagram" ? "instagram" : "openwa",
    quick_reply_options: canal === "whatsapp" && quickReplyOptions?.length ? quickReplyOptions : null,
  });

  return NextResponse.json({ ok: true });
}
