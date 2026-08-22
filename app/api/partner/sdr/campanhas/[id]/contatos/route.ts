import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

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

function validarTelefone(raw: string): { valido: boolean; normalizado: string } {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return { valido: digits.length >= 10 && digits.length <= 13, normalizado: digits };
}

// POST — recebe contatos já parseados (client-side) e enfileira (status
// "pendente" ou "invalido"). Não dispara nenhum envio.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const body = await req.json() as { contatos: Array<{ phone: string; nome?: string | null }> };
  if (!Array.isArray(body.contatos) || body.contatos.length === 0) {
    return NextResponse.json({ error: "Lista de contatos vazia" }, { status: 400 });
  }

  const db = svc();
  const { data: campanha } = await db.from("sdr_campanhas_whatsapp").select("id").eq("id", id).eq("partner_id", auth.user.id).single();
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const rows = body.contatos.slice(0, 5000).map((c) => {
    const { valido, normalizado } = validarTelefone(c.phone);
    return {
      campanha_id: id,
      phone: normalizado || String(c.phone ?? "").trim(),
      nome: c.nome?.trim() || null,
      status: valido ? "pendente" : "invalido",
      erro_detalhe: valido ? null : "Telefone com formato inválido (esperado 10-13 dígitos)",
    };
  });

  const { error } = await db.from("sdr_campanha_whatsapp_contatos").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await db
    .from("sdr_campanha_whatsapp_contatos")
    .select("id", { count: "exact", head: true })
    .eq("campanha_id", id);
  await db.from("sdr_campanhas_whatsapp").update({ total_contatos: count ?? rows.length }).eq("id", id);

  const validos = rows.filter((r) => r.status === "pendente").length;
  return NextResponse.json({ ok: true, inseridos: rows.length, validos, invalidos: rows.length - validos });
}

// DELETE — remove um contato da fila
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authGuard();
  if (!auth) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { id } = await params;

  const contatoId = req.nextUrl.searchParams.get("contato_id");
  if (!contatoId) return NextResponse.json({ error: "contato_id obrigatório" }, { status: 400 });

  const db = svc();
  const { data: campanha } = await db.from("sdr_campanhas_whatsapp").select("id").eq("id", id).eq("partner_id", auth.user.id).single();
  if (!campanha) return NextResponse.json({ error: "Campanha não encontrada" }, { status: 404 });

  const { error } = await db.from("sdr_campanha_whatsapp_contatos").delete().eq("id", contatoId).eq("campanha_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { count } = await db
    .from("sdr_campanha_whatsapp_contatos")
    .select("id", { count: "exact", head: true })
    .eq("campanha_id", id);
  await db.from("sdr_campanhas_whatsapp").update({ total_contatos: count ?? 0 }).eq("id", id);

  return NextResponse.json({ ok: true });
}
