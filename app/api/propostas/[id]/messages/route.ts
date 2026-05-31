import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await svc().from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await svc()
    .from("proposal_messages")
    .select("*")
    .eq("proposal_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [] });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ALLOWED.includes(profile?.role ?? "")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { content, type } = await req.json();
  if (!content?.trim()) return NextResponse.json({ error: "content obrigatório" }, { status: 422 });

  const validTypes = ["internal_note", "client_update", "system_event"];
  const msgType = validTypes.includes(type) ? type : "internal_note";

  const { data, error } = await svc()
    .from("proposal_messages")
    .insert({
      proposal_id: id,
      sender_id:   user.id,
      sender_name: profile?.full_name ?? "Mesa M&A",
      sender_role: profile?.role ?? "MESA_OPERACIONAL",
      content:     content.trim(),
      type:        msgType,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
