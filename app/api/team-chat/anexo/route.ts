import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { BUCKET_ANEXO_CHAT, EXTENSOES_DOWNLOAD, salaDoCaminhoAnexo } from "@/lib/team-chat-anexo";

const NO_STORE = { "Cache-Control": "no-store" };
const LINK_SEGUNDOS = 60;

// GET /api/team-chat/anexo?path=: anexo de conversa interna. Política de sigilo (BRIEF 01/11/2026): o bucket é
// privado e o arquivo só sai por aqui, para quem tem acesso à sala do anexo, com o acesso registrado ANTES e
// link assinado de 60 segundos. Anônimo: 401. Qualquer outro caso: 404 genérico.
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const naoEncontrado = NextResponse.json({ error: "Anexo não encontrado" }, { status: 404, headers: NO_STORE });
  const path = new URL(req.url).searchParams.get("path") ?? "";
  const sala = salaDoCaminhoAnexo(path);
  if (!sala) return naoEncontrado;

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: temAcesso, error: erroAcesso } = await db.rpc("user_can_access_team_room", {
    p_room_id: sala,
    p_user_id: user.id,
  });
  if (erroAcesso || temAcesso !== true) return naoEncontrado;

  const { data: perfil } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();

  // Registro do acesso ANTES do dado: falhou o log, o anexo não sai.
  const { error: logErr } = await db.from("audit_logs").insert({
    user_id: user.id,
    user_name: (perfil as { full_name?: string } | null)?.full_name ?? null,
    action: "team_chat_anexo_aberto",
    entity: "team_chat_rooms",
    entity_id: sala,
    new_data: { perfil: (perfil as { role?: string } | null)?.role ?? null },
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logErr) {
    console.error("[team-chat/anexo] falha ao gravar log de acesso", { code: logErr.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente" }, { status: 500, headers: NO_STORE });
  }

  const extensao = path.slice(path.lastIndexOf(".") + 1);
  const { data: link, error } = await db.storage
    .from(BUCKET_ANEXO_CHAT)
    .createSignedUrl(path, LINK_SEGUNDOS, EXTENSOES_DOWNLOAD.has(extensao) ? { download: true } : undefined);
  if (error || !link?.signedUrl) return naoEncontrado;
  return NextResponse.redirect(link.signedUrl, { status: 302, headers: NO_STORE });
}
