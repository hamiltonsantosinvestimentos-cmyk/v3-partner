import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { sendText } from "@/lib/whatsapp/openwa-client";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { phone, text } = await req.json() as { phone: string; text: string };
  if (!phone || !text) return NextResponse.json({ error: "phone e text obrigatórios" }, { status: 400 });

  const sent = await sendText(phone, text);
  if (!sent) {
    return NextResponse.json({ error: "Falha ao enviar via OpenWA" }, { status: 500 });
  }

  // Salva no histórico como assistant (mas marcado como humano)
  await svc().from("sdr_conversas").insert({
    phone,
    role: "assistant",
    content: `[${profile?.full_name ?? "Operador"}] ${text}`,
    instance: "openwa",
  });

  return NextResponse.json({ ok: true });
}
