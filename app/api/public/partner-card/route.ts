import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

// Endpoint PÚBLICO (sem auth) — usado pelas páginas de compartilhamento fora
// da plataforma (ex: /simulador-home-equity-v3?ref=<partner_id>) para
// personalizar o CTA com o nome/WhatsApp de quem enviou o link. Devolve só o
// mínimo necessário para isso (nome + telefone), nunca email nem outros
// dados de profiles. 404 silencioso se o id não existir ou não for partner.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const { data } = await svc()
    .from("profiles")
    .select("full_name, phone, role")
    .eq("id", id)
    .single();

  if (!data || !PARTNER_ROLES.includes((data as { role?: string }).role ?? "")) {
    return NextResponse.json({ error: "não encontrado" }, { status: 404 });
  }

  const digits = (data.phone ?? "").replace(/\D/g, "");
  return NextResponse.json({
    full_name: data.full_name ?? null,
    whatsapp: digits.length >= 10 ? digits : null,
  });
}
