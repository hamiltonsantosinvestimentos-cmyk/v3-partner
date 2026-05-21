import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Apenas ADMIN e GESTAO podem criar VDR — compliance-sensitive
const ALLOWED = ["ADMIN", "GESTAO"];

// ── GET /api/ma/deal-rooms?deal_id=... ─────────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a ADMIN e GESTAO" }, { status: 403 });
  }

  const deal_id = new URL(req.url).searchParams.get("deal_id");
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const { data: rooms, error } = await db
    .from("deal_rooms")
    .select(`
      id, name, status, nda_required, expires_at, created_at,
      deal_room_invites (
        id, investor_name, investor_email, investor_company,
        status, source_group, access_side, access_count,
        first_accessed_at, sent_at, token_expires_at,
        nda_signatures ( signed_at )
      ),
      deal_room_documents ( id, label, doc_type, sort_order )
    `)
    .eq("deal_id", deal_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rooms: rooms ?? [] });
}

// ── POST /api/ma/deal-rooms ─────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a ADMIN e GESTAO" }, { status: 403 });
  }

  const body = await req.json();
  const { deal_id, name, nda_required = true, nda_text, expires_at } = body;

  if (!deal_id || !name) {
    return NextResponse.json({ error: "deal_id e name são obrigatórios" }, { status: 422 });
  }

  const { data: room, error } = await db
    .from("deal_rooms")
    .insert({
      deal_id,
      created_by:   user.id,
      name,
      nda_required,
      nda_text:     nda_text ?? null,
      expires_at:   expires_at ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Marcar deal como tendo deal room
  await db.from("ma_deals").update({ has_deal_room: true }).eq("id", deal_id);

  return NextResponse.json({ deal_room_id: room.id, status: room.status });
}
