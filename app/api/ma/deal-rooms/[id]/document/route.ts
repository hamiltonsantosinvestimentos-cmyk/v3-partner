import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO"];
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: deal_room_id } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a ADMIN e GESTAO" }, { status: 403 });
  }

  const { label, doc_type = "cim", storage_path, requires_nda = true } = await req.json();
  if (!label || !storage_path) {
    return NextResponse.json({ error: "label e storage_path são obrigatórios" }, { status: 422 });
  }

  const { data, error } = await db.from("deal_room_documents").insert({
    deal_room_id, label, doc_type, storage_path, requires_nda, sort_order: 1,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ document_id: data.id });
}
