import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

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

  const { phone, text, instance } = await req.json() as { phone: string; text: string; instance?: string };
  if (!phone || !text) return NextResponse.json({ error: "phone e text obrigatórios" }, { status: 400 });

  const instanceName = instance ?? "v3-sdr-whatsapp";

  // Envia via Evolution API
  const res = await fetch(
    `${process.env.EVOLUTION_API_URL}/message/sendText/${instanceName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY!,
      },
      body: JSON.stringify({ number: phone, text }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: `Evolution API: ${err.slice(0, 200)}` }, { status: 500 });
  }

  // Salva no histórico como assistant (mas marcado como humano)
  await svc().from("sdr_conversas").insert({
    phone,
    role: "assistant",
    content: `[${profile?.full_name ?? "Operador"}] ${text}`,
    instance: instanceName,
  });

  return NextResponse.json({ ok: true });
}
