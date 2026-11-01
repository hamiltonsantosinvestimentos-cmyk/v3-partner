import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { BUCKET_ANEXO_CHAT } from "@/lib/team-chat-anexo";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
};

// Política de sigilo (BRIEF 01/11/2026): o upload só funciona com o bucket privado. Enquanto o bucket for público
// (ou a consulta falhar), a rota recusa com 503, então o anexo nunca nasce aberto na internet. A rota devolve só o
// caminho do arquivo; a leitura passa por /api/team-chat/anexo (sessão, sala, log e link assinado de 60 s).
async function bucketPrivado(): Promise<boolean> {
  const { data, error } = await svc().storage.getBucket(BUCKET_ANEXO_CHAT);
  return !error && data?.public === false;
}

export async function POST(req: NextRequest) {
  if (!(await bucketPrivado())) {
    return NextResponse.json(
      { error: "Anexos do chat de equipe estão indisponíveis até a revisão de segurança" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData inválido" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const room_id = formData.get("room_id") as string | null;

  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });
  if (!room_id) return NextResponse.json({ error: "room_id obrigatório" }, { status: 400 });

  // Verifica acesso à sala
  const { data: hasAccess } = await svc().rpc("user_can_access_team_room", {
    p_room_id: room_id,
    p_user_id: user.id,
  });

  if (!hasAccess) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Verifica tamanho
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Arquivo excede o limite de 10MB" }, { status: 413 });
  }

  // Verifica tipo
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Tipo de arquivo não permitido" },
      { status: 415 }
    );
  }

  const uniqueId = crypto.randomUUID();
  const storagePath = `${room_id}/${uniqueId}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await svc()
    .storage
    .from(BUCKET_ANEXO_CHAT)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  return NextResponse.json({
    path: storagePath,
    name: file.name.slice(0, 200),
    type: file.type,
  });
}
