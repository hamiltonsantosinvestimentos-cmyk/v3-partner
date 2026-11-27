// Revela WhatsApp e e-mail do cliente de um pedido de cota nova, com registro antes do dado.
// BRIEF docs/briefs/2026-11-27_contratar-cota-nova-em-projetos.md
// Só equipe interna e quem enviou. Pedido inexistente ou excluído = 404 sem log. Falhou o log, o dado não sai.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { idsDaEquipe } from "@/lib/enterprise";
import { ehInterno } from "../../../vitrine";
import { decidirRevelacao, type Viewer } from "@/lib/consorcio/contratacoes";

export const dynamic = "force-dynamic";
const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });

  const { id } = await params;
  const naoEncontrado = NextResponse.json({ error: "Pedido não encontrado." }, { status: 404, headers: NO_STORE });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return naoEncontrado;

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: perfil } = await db.from("profiles").select("id, full_name, role, enterprise_id").eq("id", user.id).maybeSingle();
  const p = perfil as { full_name: string | null; role: string | null; enterprise_id: string | null } | null;
  const interno = ehInterno(p?.role);
  const viewer: Viewer = { id: user.id, interno, equipe: interno ? [] : await idsDaEquipe(db, { id: user.id, role: p?.role ?? null, enterprise_id: p?.enterprise_id ?? null }) };

  const { data: linha, error } = await db.from("consorcio_contratacoes")
    .select("id, created_by, deleted_at, cliente_whatsapp, cliente_email").eq("id", id).maybeSingle();
  if (error) {
    console.error("[consorcio/contratacoes/contato]", error.code);
    return NextResponse.json({ error: "Não foi possível abrir o contato agora." }, { status: 500, headers: NO_STORE });
  }
  const l = linha as { created_by: string | null; deleted_at: string | null; cliente_whatsapp: string; cliente_email: string | null } | null;
  const decisao = decidirRevelacao(viewer, l);
  if (decisao === 404) return naoEncontrado;
  if (decisao === 403) return NextResponse.json({ error: "Você não tem acesso a este contato." }, { status: 403, headers: NO_STORE });

  // Registro do acesso ANTES do dado: falhou o log, o contato não sai.
  const { error: logErr } = await db.from("audit_logs").insert({
    user_id: user.id,
    user_name: p?.full_name ?? null,
    action: "REVEAL_CONTATO_CONTRATACAO",
    entity: "consorcio_contratacoes",
    entity_id: id,
    new_data: { perfil: interno ? "INTERNO" : "QUEM_ENVIOU" },
    ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null,
  });
  if (logErr) {
    console.error("[consorcio/contratacoes/contato] falha ao gravar log", { code: logErr.code });
    return NextResponse.json({ error: "Não foi possível registrar o acesso, tente novamente." }, { status: 500, headers: NO_STORE });
  }

  return NextResponse.json({ whatsapp: l!.cliente_whatsapp, email: l!.cliente_email }, { headers: NO_STORE });
}
