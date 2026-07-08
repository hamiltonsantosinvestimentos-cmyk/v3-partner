import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { isValidSector } from "@/lib/sector-goals";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

async function getAuthedAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!ADMIN_ROLES.includes(profile?.role ?? "")) return null;
  return user;
}

// GET ?sector=X — lista todos os itens de 5W2H do setor
export async function GET(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const sector = req.nextUrl.searchParams.get("sector") ?? "";
  if (!isValidSector(sector)) return NextResponse.json({ error: "Setor inválido" }, { status: 400 });

  const { data, error } = await serviceClient()
    .from("sector_5w2h")
    .select("*")
    .eq("sector", sector)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

// POST — cria um novo item de 5W2H
export async function POST(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { sector, o_que, por_que, onde, quando, quem, como, quanto_custa, prazo } = body;
  if (!isValidSector(sector)) return NextResponse.json({ error: "Setor inválido" }, { status: 400 });

  const { data, error } = await serviceClient().from("sector_5w2h").insert({
    sector, o_que, por_que, onde, quando, quem, como, quanto_custa,
    prazo: prazo || null,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}

// PATCH — edita um item existente (inclui marcar/desmarcar como concluído)
export async function PATCH(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { id, concluido, ...fields } = body as {
    id: string; concluido?: boolean;
    o_que?: string; por_que?: string; onde?: string; quando?: string; quem?: string; como?: string; quanto_custa?: string; prazo?: string | null;
  };
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const updateData: Record<string, unknown> = {
    ...fields,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  };
  if (concluido !== undefined) {
    updateData.concluido = concluido;
    updateData.concluido_em = concluido ? new Date().toISOString() : null;
  }

  const { error } = await serviceClient().from("sector_5w2h").update(updateData).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE ?id=X — remove um item
export async function DELETE(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const { error } = await serviceClient().from("sector_5w2h").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
