import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function validateInstituicao(instituicao_id: string) {
  const { data } = await svc()
    .from("instituicoes")
    .select("id, nome, status, auth_user_id")
    .eq("id", instituicao_id)
    .single();
  return data;
}

// GET /api/instituicao/chat?instituicao_id=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instituicao_id = searchParams.get("instituicao_id");
  if (!instituicao_id) return NextResponse.json({ error: "instituicao_id obrigatório" }, { status: 400 });

  const inst = await validateInstituicao(instituicao_id);
  if (!inst) return NextResponse.json({ error: "Instituição não encontrada" }, { status: 403 });

  const room_id = `instituicao_${instituicao_id}`;
  const { data, error } = await svc()
    .from("chat_messages")
    .select("id, room_id, sender_id, sender_name, sender_role, content, created_at")
    .eq("room_id", room_id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ messages: data ?? [], instituicao_nome: inst.nome });
}

// POST /api/instituicao/chat
export async function POST(request: Request) {
  const { instituicao_id, content } = await request.json();
  if (!instituicao_id || !content?.trim()) {
    return NextResponse.json({ error: "instituicao_id e content são obrigatórios" }, { status: 400 });
  }

  const inst = await validateInstituicao(instituicao_id);
  if (!inst) return NextResponse.json({ error: "Instituição não encontrada" }, { status: 403 });

  const room_id = `instituicao_${instituicao_id}`;
  const { data: msg, error } = await svc()
    .from("chat_messages")
    .insert({
      room_id,
      sender_id: inst.auth_user_id, // auth.users UUID — satisfaz a FK constraint
      sender_name: inst.nome,
      sender_role: "INSTITUICAO",
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: msg }, { status: 201 });
}
