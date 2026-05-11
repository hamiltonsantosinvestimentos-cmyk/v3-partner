import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/**
 * POST /api/prospeccao/publico
 * Endpoint público — não exige autenticação.
 * Recebe dados do formulário da página /indicacao e:
 *   - Se vier com token (ref): atualiza o prospect existente com os dados preenchidos e avança para "contatado"
 *   - Se não tiver token: cria novo prospect com etapa "prospect"
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    token, nome, documento, email, telefone, cidade, estado, origem, indicado_por_nome,
  } = body as Record<string, string>;

  if (!nome?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Nome e e-mail são obrigatórios" }, { status: 400 });
  }

  const db = svc();

  if (token) {
    // Busca o prospect pelo token
    const { data: lead } = await db
      .from("prospeccao_leads")
      .select("id, etapa, nome")
      .eq("link_token", token)
      .single();

    if (!lead) {
      return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });
    }

    const leadId = (lead as { id: string }).id;
    const etapaAtual = (lead as { etapa: string }).etapa;

    // Atualiza dados e avança etapa para "contatado" se ainda estiver em "prospect"
    const novaEtapa = etapaAtual === "prospect" ? "contatado" : etapaAtual;

    await db.from("prospeccao_leads").update({
      nome: nome.trim(),
      documento: documento || null,
      email: email.trim(),
      telefone: telefone || null,
      cidade: cidade || null,
      estado: estado || null,
      origem: origem || "outro",
      indicado_por_nome: indicado_por_nome || null,
      etapa: novaEtapa,
    }).eq("id", leadId);

    // Registra no histórico
    if (novaEtapa !== etapaAtual) {
      await db.from("prospeccao_historico").insert({
        lead_id: leadId,
        etapa_anterior: etapaAtual,
        etapa_nova: novaEtapa,
        nota: "Prospect preencheu o formulário via link",
      });
    }

    return NextResponse.json({ ok: true, leadId });
  }

  // Sem token — cria novo prospect
  const { data, error } = await db.from("prospeccao_leads").insert({
    nome: nome.trim(),
    documento: documento || null,
    email: email.trim(),
    telefone: telefone || null,
    cidade: cidade || null,
    estado: estado || null,
    origem: origem || "outro",
    indicado_por_nome: indicado_por_nome || null,
    etapa: "prospect",
  }).select("id").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, leadId: (data as { id: string }).id }, { status: 201 });
}
