import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveContentType } from "@/lib/credit-documents/content-type";
import { ANEXOS_BUCKET, ehMesa, salaDoPartner, svc } from "@/lib/chat-partners";

export const dynamic = "force-dynamic";
const MAX = 15 * 1024 * 1024;

// POST multipart { file, room_id } — sobe o anexo no bucket privado chat-anexos/<room_id>/…
// Devolve { path, nome, tipo, tamanho } para ir junto da mensagem.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const fd = await req.formData().catch(() => null);
  const file = fd?.get("file") as File | null;
  const room_id = fd?.get("room_id") as string | null;
  if (!file || !room_id) return NextResponse.json({ error: "Arquivo e sala são obrigatórios" }, { status: 400 });

  const db = svc();
  const { data: p } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ehMesa(p?.role as string) && room_id !== salaDoPartner(user.id)) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  if (file.size > MAX) return NextResponse.json({ error: "Arquivo acima de 15 MB" }, { status: 413 });
  const tipo = resolveContentType(file.name, file.type);
  if (!tipo) return NextResponse.json({ error: "Tipo não suportado. Envie PDF, imagem, DOC ou DOCX." }, { status: 415 });

  const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
  const path = `${room_id}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}_${nomeSeguro}`;
  const { error } = await db.storage.from(ANEXOS_BUCKET).upload(path, await file.arrayBuffer(), { contentType: tipo });
  if (error) {
    const semBucket = /bucket not found/i.test(error.message);
    return NextResponse.json(
      { error: semBucket ? "Anexos ficam disponíveis depois da atualização do banco (migration do chat)." : error.message },
      { status: semBucket ? 503 : 500 },
    );
  }
  return NextResponse.json({ path, nome: file.name, tipo, tamanho: file.size });
}
