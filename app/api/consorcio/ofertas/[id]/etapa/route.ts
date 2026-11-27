// Etapa de acompanhamento da oferta de cota contemplada (Kanban de Consórcio › Projetos).
// BRIEF docs/briefs/2026-11-27_kanban-consorcio-projetos.md
// Só ADMIN e GESTAO. Não muda o status da oferta: aceitar continua só na carta.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ROTULO_ETAPA_OFERTA, ehEtapaOferta, etapaDaOferta, podeMover, textoEvento } from "@/lib/consorcio/kanban";
import { avisar, faltaNoBanco, registrarEvento } from "@/lib/consorcio/kanban-db";

export const dynamic = "force-dynamic";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: perfil } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!podeMover((perfil as { role?: string } | null)?.role)) return NextResponse.json({ error: "Só ADMIN e GESTÃO mudam a etapa." }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { etapa?: unknown } | null;
  if (!UUID.test(id) || !ehEtapaOferta(body?.etapa)) return NextResponse.json({ error: "Oferta ou etapa inválida." }, { status: 400 });
  const etapa = body.etapa;

  const { data: atual, error: lErr } = await db.from("consorcio_ofertas").select("id, carta_code, created_by, etapa").eq("id", id).maybeSingle();
  if (lErr) {
    if (faltaNoBanco(lErr)) return NextResponse.json({ error: "Etapas indisponíveis no momento." }, { status: 503 });
    console.error("[consorcio/ofertas/etapa] leitura", lErr.code);
    return NextResponse.json({ error: "Não foi possível mover agora. Tente de novo." }, { status: 500 });
  }
  if (!atual) return NextResponse.json({ error: "Oferta não encontrada." }, { status: 404 });
  const a = atual as { carta_code: string | null; created_by: string | null; etapa: string | null };
  const de = etapaDaOferta(a.etapa);
  if (de === etapa) return NextResponse.json({ ok: true, etapa });

  const agora = new Date().toISOString();
  const { error } = await db.from("consorcio_ofertas")
    .update({ etapa, etapa_atualizada_em: agora, etapa_atualizada_por: user.id }).eq("id", id);
  if (error) {
    console.error("[consorcio/ofertas/etapa] update", error.code);
    return NextResponse.json({ error: "Não foi possível mover agora. Tente de novo." }, { status: 500 });
  }

  await registrarEvento(db, "OFERTA", id, user.id, textoEvento(ROTULO_ETAPA_OFERTA[de], ROTULO_ETAPA_OFERTA[etapa]));
  if (a.created_by && a.created_by !== user.id) {
    await avisar(db, [a.created_by], "Oferta atualizada",
      `Sua oferta pela carta ${a.carta_code ?? ""} agora está em: ${ROTULO_ETAPA_OFERTA[etapa]}.`, "/consorcio/projetos#ofertas");
  }
  return NextResponse.json({ ok: true, etapa });
}
