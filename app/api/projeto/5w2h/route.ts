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

export async function GET(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const sector = req.nextUrl.searchParams.get("sector") ?? "";
  if (!isValidSector(sector)) return NextResponse.json({ error: "Setor inválido" }, { status: 400 });

  const { data } = await serviceClient().from("sector_5w2h").select("*").eq("sector", sector).maybeSingle();
  return NextResponse.json({ data: data ?? { sector, o_que: "", por_que: "", onde: "", quando: "", quem: "", como: "", quanto_custa: "" } });
}

export async function PATCH(req: NextRequest) {
  const user = await getAuthedAdmin();
  if (!user) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = await req.json();
  const { sector, o_que, por_que, onde, quando, quem, como, quanto_custa } = body;
  if (!isValidSector(sector)) return NextResponse.json({ error: "Setor inválido" }, { status: 400 });

  const { error } = await serviceClient().from("sector_5w2h").upsert({
    sector, o_que, por_que, onde, quando, quem, como, quanto_custa,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  }, { onConflict: "sector" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
