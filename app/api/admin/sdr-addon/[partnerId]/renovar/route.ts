import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// PATCH — registra que o partner pagou o mês (confirmado por fora, ex: Pix)
// e marca a próxima data de cobrança. Body opcional { proxima_cobranca: "YYYY-MM-DD" };
// sem isso, usa hoje + 30 dias.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ partnerId: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { partnerId } = await params;
  const body = await req.json().catch(() => ({})) as { proxima_cobranca?: string };

  const hoje = new Date();
  let proximaCobranca = body.proxima_cobranca;
  if (!proximaCobranca) {
    const d = new Date(hoje);
    d.setDate(d.getDate() + 30);
    proximaCobranca = d.toISOString().slice(0, 10);
  }

  const db = svc();
  const { error } = await db.from("partner_sdr_connections").update({
    addon_ultimo_pagamento_em: hoje.toISOString().slice(0, 10),
    addon_proxima_cobranca: proximaCobranca,
    // Se estava pausado por atraso, o pagamento já reativa automaticamente.
    addon_ativo: true,
    addon_status: "ativo",
    updated_at: hoje.toISOString(),
  }).eq("partner_id", partnerId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, proxima_cobranca: proximaCobranca });
}
