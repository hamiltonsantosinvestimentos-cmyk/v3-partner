import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

// POST /api/consorcio/ofertas/[id]/aceitar
//
// Governanca Documental Universal, Fase 2b (10/08/2026): esta rota e o
// unico ponto do sistema que marca uma carta contemplada como VENDIDA de
// verdade. Antes dela nao existia nenhum caminho de codigo que escrevesse
// esse status -- consorcio_ofertas/consorcio_cartas ficavam para sempre em
// NEGOCIACAO. Decisao de Joao: aceitar uma oferta cancela automaticamente
// as demais ofertas pendentes da mesma carta, e so aqui (nunca na criacao
// da oferta) nasce a pasta MPS do cliente, porque uma oferta pode nunca
// virar venda.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Sem permissão para aceitar oferta" }, { status: 403 });
  }

  const { data: oferta, error: ofertaErr } = await svc
    .from("consorcio_ofertas")
    .select("id, carta_id, carta_code, interessado_nome, status")
    .eq("id", id)
    .single();
  if (ofertaErr || !oferta) return NextResponse.json({ error: "Oferta não encontrada" }, { status: 404 });
  if (oferta.status !== "pendente") {
    return NextResponse.json({ error: `Oferta já está "${oferta.status}", não pode ser aceita novamente` }, { status: 409 });
  }

  // 1. Aceita esta oferta
  const { error: acceptErr } = await svc
    .from("consorcio_ofertas")
    .update({ status: "aceita" })
    .eq("id", id);
  if (acceptErr) return NextResponse.json({ error: acceptErr.message }, { status: 500 });

  // 2. Cancela as demais ofertas pendentes da mesma carta (decisão de João, 10/08/2026)
  const { error: cancelErr } = await svc
    .from("consorcio_ofertas")
    .update({ status: "cancelada" })
    .eq("carta_id", oferta.carta_id)
    .eq("status", "pendente")
    .neq("id", id);
  if (cancelErr) console.error("[consorcio/ofertas/aceitar] falha ao cancelar ofertas concorrentes", cancelErr.message);

  // 3. Marca a carta como VENDIDA — é este evento, não a oferta em si, que
  // representa a aquisição real do cliente
  const { error: cartaErr } = await svc
    .from("consorcio_cartas")
    .update({ status: "VENDIDA" })
    .eq("id", oferta.carta_id);
  if (cartaErr) return NextResponse.json({ error: cartaErr.message }, { status: 500 });

  // 4. Pasta MPS do cliente, best-effort, nunca bloqueia a aceitação
  const { error: folderError } = await svc.rpc("create_deal_folder", {
    p_vertical: "Consorcios",
    p_deal_code: oferta.carta_code,
    p_client_name: oferta.interessado_nome,
    p_user_id: user.id,
  });
  if (folderError) console.error("[consorcio/ofertas/aceitar] falha ao criar pasta MPS", folderError.message);

  return NextResponse.json({ ok: true });
}
