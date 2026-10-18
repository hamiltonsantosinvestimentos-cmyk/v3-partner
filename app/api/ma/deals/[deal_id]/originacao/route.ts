import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import {
  ORIGINACAO_ROLES, UNIDADES, gateEtapa1, parseDataBR, parseSaidaE1, promptE1, validarFato, type FatoInput,
} from "@/lib/ma/originacao";

// Aba "Originação" da Mesa M&A, Etapa 1 (BRIEF 2026-10-17).
// GET: estado da esteira do deal. POST: ações (iniciar, extrair, adicionar_fato, avancar).
// Sem notificação à equipe nesta fatia: nada aqui dispara push ou e-mail.

export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type RouteContext = { params: Promise<{ deal_id: string }> };

async function caller() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !(ORIGINACAO_ROLES as readonly string[]).includes(profile.role as string)) return null;
  return { userId: user.id };
}

async function carregar(dealId: string, userId: string) {
  const db = svc();
  const { data: deal, error } = await db
    .from("ma_deals")
    .select("id, origination_stage, origination_meeting_date, origination_decision, origination_meeting_summary_id, asset_data, deleted_at")
    .eq("id", dealId)
    .single();
  if (error || !deal || deal.deleted_at) return null;
  const [nomes, fatos, reunioes] = await Promise.all([
    db.from("ma_origination_names").select("id, tipo, grafias, grafia_provavel, grafia_confirmada, status, confirmed_at").eq("deal_id", dealId),
    db.from("ma_origination_facts").select("id, tema, afirmacao, quem_disse, rotulo, fonte, fonte_data, valor_min, valor_max, unidade, moeda, ausencia, ordem").eq("deal_id", dealId).order("ordem", { ascending: true }),
    // Reuniões candidatas: as já ligadas a este deal e as do próprio usuário, sem deal, dos últimos 60 dias.
    db.from("meeting_summaries").select("id, title, meeting_date, ma_deal_id")
      .or(`ma_deal_id.eq.${dealId},and(ma_deal_id.is.null,user_id.eq.${userId})`)
      .gte("meeting_date", new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10))
      .order("meeting_date", { ascending: false })
      .limit(50),
  ]);
  // Nomes: A_CONFIRMAR primeiro, depois alfabética pt-BR pela grafia provável (regra 4.1).
  const nomesOrd = (nomes.data ?? []).sort((a, b) =>
    (a.status === "A_CONFIRMAR" ? 0 : 1) - (b.status === "A_CONFIRMAR" ? 0 : 1) ||
    String(a.grafia_provavel ?? a.grafias?.[0] ?? "").localeCompare(String(b.grafia_provavel ?? b.grafias?.[0] ?? ""), "pt-BR"));
  const origin = ((deal.asset_data as Record<string, unknown> | null)?.originacao ?? null) as Record<string, unknown> | null;
  return {
    deal: {
      id: deal.id,
      etapa: deal.origination_stage,
      data_reuniao: deal.origination_meeting_date,
      decisao: deal.origination_decision,
      reuniao_id: deal.origination_meeting_summary_id,
      diagnostico: origin,
    },
    nomes: nomesOrd,
    fatos: fatos.data ?? [],
    reunioes: reunioes.data ?? [],
    unidades: UNIDADES,
    gate: gateEtapa1(nomesOrd as { status: "A_CONFIRMAR" | "CONFIRMADO" }[], (fatos.data ?? []) as { rotulo: null }[]),
  };
}

export async function GET(_req: NextRequest, ctx: RouteContext) {
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id } = await ctx.params;
  const estado = await carregar(deal_id, who.userId);
  if (!estado) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
  return NextResponse.json(estado);
}

export async function POST(req: NextRequest, ctx: RouteContext) {
  const who = await caller();
  if (!who) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const db = svc();

  const estado = await carregar(dealId, who.userId);
  if (!estado) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // ---- iniciar: liga a reunião ao deal e abre a Etapa 1
  if (action === "iniciar") {
    const reuniaoId = String(body.reuniao_id ?? "");
    const dataIso = parseDataBR(String(body.data_reuniao ?? ""));
    if (!reuniaoId) return NextResponse.json({ error: "Escolha a reunião de origem" }, { status: 422 });
    if (!dataIso) return NextResponse.json({ error: "Data da reunião inválida: use DD/MM/AAAA" }, { status: 422 });
    const { data: ms } = await db.from("meeting_summaries").select("id, ma_deal_id").eq("id", reuniaoId).single();
    if (!ms) return NextResponse.json({ error: "Reunião não encontrada" }, { status: 404 });
    if (ms.ma_deal_id && ms.ma_deal_id !== dealId) return NextResponse.json({ error: "Esta reunião já está ligada a outro deal" }, { status: 409 });
    if (!ms.ma_deal_id) {
      const { error } = await db.from("meeting_summaries").update({ ma_deal_id: dealId }).eq("id", reuniaoId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { error } = await db.from("ma_deals").update({
      origination_stage: estado.deal.etapa ?? 1,
      origination_meeting_date: dataIso,
      origination_meeting_summary_id: reuniaoId,
    }).eq("id", dealId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(await carregar(dealId, who.userId));
  }

  // ---- extrair: roda o prompt E1 sobre a transcrição
  if (action === "extrair") {
    if (!estado.deal.reuniao_id) return NextResponse.json({ error: "Ligue a reunião de origem antes de extrair" }, { status: 422 });
    if ((estado.deal.etapa ?? 1) > 1) return NextResponse.json({ error: "Etapa 1 já concluída; a ficha está congelada" }, { status: 409 });
    const { data: ms } = await db.from("meeting_summaries").select("transcript, participants").eq("id", estado.deal.reuniao_id).single();
    const transcript = String(ms?.transcript ?? "");
    if (transcript.length < 200) return NextResponse.json({ error: "Reunião sem transcrição utilizável" }, { status: 422 });

    const confirmados = estado.nomes.filter(n => n.status === "CONFIRMADO").map(n => String(n.grafia_confirmada));
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    let texto = "";
    try {
      const resp = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 12000,
        system: [{ type: "text", text: promptE1(), cache_control: { type: "ephemeral" } }],
        messages: [{
          role: "user",
          content: `Data da reunião: ${estado.deal.data_reuniao ?? "não informada"}\nParticipantes: ${JSON.stringify(ms?.participants ?? [])}\nGlossário de nomes confirmados: ${JSON.stringify(confirmados)}\n\nTranscrição:\n${transcript}`,
        }],
      });
      texto = resp.content.filter(b => b.type === "text").map(b => (b as { text: string }).text).join("");
    } catch (e) {
      return NextResponse.json({ error: `Falha na extração: ${(e as Error).message}` }, { status: 502 });
    }

    let saida;
    try { saida = parseSaidaE1(texto, confirmados); }
    catch (e) { return NextResponse.json({ error: `Resposta do modelo ilegível: ${(e as Error).message}` }, { status: 502 }); }

    // Reextração substitui os fatos extraídos desta reunião e os nomes pendentes; fatos manuais e nomes confirmados ficam.
    const del1 = await db.from("ma_origination_facts").delete().eq("deal_id", dealId).eq("meeting_summary_id", estado.deal.reuniao_id);
    const del2 = await db.from("ma_origination_names").delete().eq("deal_id", dealId).eq("status", "A_CONFIRMAR");
    if (del1.error || del2.error) return NextResponse.json({ error: (del1.error ?? del2.error)!.message }, { status: 500 });

    const jaConfirmadas = new Set(estado.nomes.filter(n => n.status === "CONFIRMADO").map(n => String(n.grafia_confirmada).toLowerCase()));
    const agora = new Date().toISOString();
    const nomesRows = saida.nomes
      .filter(n => !n.grafias.some(g => jaConfirmadas.has(g.toLowerCase())))
      .map(n => ({ deal_id: dealId, tipo: n.tipo, grafias: n.grafias, grafia_provavel: n.grafia_provavel, status: "A_CONFIRMAR" }));
    if (nomesRows.length) {
      const { error } = await db.from("ma_origination_names").insert(nomesRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const fatosRows = saida.fatos.map((f, i) => ({ ...f, deal_id: dealId, meeting_summary_id: estado.deal.reuniao_id, ordem: i, created_by: who.userId }));
    if (fatosRows.length) {
      const { error } = await db.from("ma_origination_facts").insert(fatosRows);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const { data: atual } = await db.from("ma_deals").select("asset_data").eq("id", dealId).single();
    const asset = { ...((atual?.asset_data as Record<string, unknown>) ?? {}) };
    asset.originacao = {
      dor: saida.dor, tese: saida.tese, gargalos: saida.gargalos, proximos_passos: saida.proximos_passos,
      extraido_em: agora, extraido_por: who.userId, fatos_rejeitados: saida.rejeitados,
    };
    const { error: e3 } = await db.from("ma_deals").update({ asset_data: asset, origination_decision: saida.decisao }).eq("id", dealId);
    if (e3) return NextResponse.json({ error: e3.message }, { status: 500 });
    return NextResponse.json({ ...(await carregar(dealId, who.userId)), rejeitados: saida.rejeitados.length });
  }

  // ---- adicionar_fato: fato manual do analista
  if (action === "adicionar_fato") {
    const f = body.fato as FatoInput;
    const erros = validarFato(f ?? ({} as FatoInput));
    if (erros.length) return NextResponse.json({ error: erros.join("; ") }, { status: 422 });
    const { error } = await db.from("ma_origination_facts").insert({
      ...f, deal_id: dealId, ordem: estado.fatos.length, created_by: who.userId, meeting_summary_id: null, // manual: a reextração não apaga
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json(await carregar(dealId, who.userId));
  }

  // ---- avancar: trava da Etapa 1, conferida no servidor
  if (action === "avancar") {
    if ((estado.deal.etapa ?? 0) !== 1) return NextResponse.json({ error: "O deal não está na Etapa 1" }, { status: 409 });
    if (!estado.gate.ok) return NextResponse.json({ error: `Etapa 1 bloqueada: ${estado.gate.motivos.join(", ")}` }, { status: 422 });
    const { error } = await db.from("ma_deals").update({ origination_stage: 2 }).eq("id", dealId).eq("origination_stage", 1);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(await carregar(dealId, who.userId));
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
