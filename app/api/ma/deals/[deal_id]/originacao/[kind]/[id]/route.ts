import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ORIGINACAO_ROLES, validarFato, type FatoInput } from "@/lib/ma/originacao";

// Originação, Etapa 1: confirmar nome (PATCH nomes/[id]), editar fato (PATCH fatos/[id]),
// excluir fato (DELETE fatos/[id]). Ficha congelada depois que o deal sai da Etapa 1.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ deal_id: string; kind: string; id: string }> };

async function caller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !(ORIGINACAO_ROLES as readonly string[]).includes(profile.role as string)) return null;
  return { userId: user.id };
}

async function etapa1Aberta(dealId: string) {
  const { data } = await svc().from("ma_deals").select("origination_stage, deleted_at").eq("id", dealId).single();
  return !!data && !data.deleted_at && data.origination_stage === 1;
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId, kind, id } = await ctx.params;
  if (!(await etapa1Aberta(dealId))) return NextResponse.json({ error: "Ficha congelada: o deal não está na Etapa 1" }, { status: 409 });
  const body = await req.json().catch(() => ({}));
  const db = svc();

  if (kind === "nomes") {
    const grafia = String(body.grafia_confirmada ?? "").trim();
    if (!grafia) return NextResponse.json({ error: "Informe a grafia confirmada" }, { status: 422 });
    const { data, error } = await db.from("ma_origination_names")
      .update({ grafia_confirmada: grafia, status: "CONFIRMADO", confirmed_by: who.userId, confirmed_at: new Date().toISOString() })
      .eq("id", id).eq("deal_id", dealId).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Nome não encontrado" }, { status: error ? 500 : 404 });
    return NextResponse.json({ ok: true });
  }

  if (kind === "fatos") {
    const f = body.fato as FatoInput;
    const erros = validarFato(f ?? ({} as FatoInput));
    if (erros.length) return NextResponse.json({ error: erros.join("; ") }, { status: 422 });
    const { data, error } = await db.from("ma_origination_facts").update({
      tema: f.tema, afirmacao: f.afirmacao, quem_disse: f.quem_disse ?? null, rotulo: f.rotulo ?? "DECLARADO_REUNIAO",
      fonte: f.fonte ?? null, fonte_data: f.fonte_data ?? null,
      valor_min: f.valor_min ?? null, valor_max: f.valor_max ?? null, unidade: f.unidade ?? null, moeda: f.moeda ?? null,
      ausencia: !!f.ausencia,
    }).eq("id", id).eq("deal_id", dealId).select("id").single();
    if (error || !data) return NextResponse.json({ error: error?.message ?? "Fato não encontrado" }, { status: error ? 422 : 404 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId, kind, id } = await ctx.params;
  if (kind !== "fatos") return NextResponse.json({ error: "Só fatos podem ser excluídos" }, { status: 400 });
  if (!(await etapa1Aberta(dealId))) return NextResponse.json({ error: "Ficha congelada: o deal não está na Etapa 1" }, { status: 409 });
  const { error } = await svc().from("ma_origination_facts").delete().eq("id", id).eq("deal_id", dealId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
