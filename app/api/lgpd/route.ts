/**
 * LGPD — Endpoint de Solicitações de Titulares (Art. 18 LGPD)
 *
 * Tipos de solicitação:
 * - ACESSO: titular quer ver seus dados pessoais
 * - CORRECAO: titular quer corrigir dado incorreto
 * - PORTABILIDADE: titular quer exportar seus dados
 * - ELIMINACAO: titular quer anonimização/exclusão
 * - REVOGACAO_CONSENTIMENTO: titular revoga consentimento
 *
 * DPO responsável: Robson Lino (compliance@v3partners.com.br)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { getClientIp, logAudit } from "@/lib/audit";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const solicitacaoSchema = z.object({
  tipo: z.enum(["ACESSO", "CORRECAO", "PORTABILIDADE", "ELIMINACAO", "REVOGACAO_CONSENTIMENTO"]),
  descricao: z.string().max(2000).optional(),
});

// POST — registra solicitação LGPD do titular
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = solicitacaoSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten() }, { status: 400 });
  }

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("full_name, email").eq("id", user.id).single();

  const ip = getClientIp(req);
  const prazoResposta = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(); // 15 dias úteis

  const { data, error } = await svc.from("lgpd_solicitacoes").insert({
    user_id: user.id,
    user_name: profile?.full_name ?? null,
    user_email: profile?.email ?? user.email,
    tipo: parsed.data.tipo,
    descricao: parsed.data.descricao ?? null,
    status: "PENDENTE",
    prazo_resposta: prazoResposta,
    ip_address: ip,
    created_at: new Date().toISOString(),
  }).select("id").single();

  if (error) {
    return NextResponse.json({ error: "Erro ao registrar solicitação" }, { status: 500 });
  }

  await logAudit({
    userId: user.id,
    userName: profile?.full_name,
    action: "CREATE",
    entity: "profiles",
    entityId: user.id,
    newData: { lgpd_tipo: parsed.data.tipo, solicitacao_id: data.id },
    ipAddress: ip,
  });

  return NextResponse.json({
    ok: true,
    solicitacao_id: data.id,
    tipo: parsed.data.tipo,
    prazo_resposta: prazoResposta,
    mensagem: `Solicitação registrada. Você receberá resposta em até 15 dias úteis conforme Art. 18 da LGPD. Protocolo: ${data.id}`,
  }, { status: 201 });
}

// GET — titular visualiza suas próprias solicitações
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();

  // ADMIN pode ver todas; titular vê apenas as suas
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  const isAdmin = profile?.role === "ADMIN";

  let query = svc.from("lgpd_solicitacoes").select("*").order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("user_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Erro ao buscar solicitações" }, { status: 500 });

  return NextResponse.json({ solicitacoes: data ?? [] });
}

// PATCH — ADMIN atualiza status da solicitação
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Apenas administradores" }, { status: 403 });

  const { id, status, resposta } = await req.json();
  if (!id || !status) return NextResponse.json({ error: "id e status obrigatórios" }, { status: 400 });

  const { error } = await svc.from("lgpd_solicitacoes").update({
    status,
    resposta: resposta ?? null,
    respondido_em: new Date().toISOString(),
    respondido_por: user.id,
  }).eq("id", id);

  if (error) return NextResponse.json({ error: "Erro ao atualizar solicitação" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
