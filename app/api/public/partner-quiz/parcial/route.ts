import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import {
  OBJETIVO, OCUPACAO, RENDA_FAIXA, EXPERIENCIA_B2B, PRIORIDADE, QUIZ_PARCIAL_PAROU_EM,
} from "@/lib/quiz-partner";

// Lead PARCIAL do quiz "Seja Partner" (/seja-partner). Chamado pelo client assim
// que o candidato deixa nome + WhatsApp + e-mail (com consentimento LGPD) e a cada
// passo seguinte. Cria/atualiza um lead em prospeccao_leads na etapa "incompleto"
// (coluna "Lead incompleto" do Kanban), casado pela sessão do quiz. Quando o quiz
// é concluído, a rota ../route.ts completa ESTE mesmo lead. Sem notificações aqui:
// WhatsApp/e-mail só saem na conclusão.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const vals = (opts: { value: string }[]) => opts.map((o) => o.value) as [string, ...string[]];

const schema = z.object({
  session_id: z.string().min(8).max(80),
  parou_em: z.enum(Object.keys(QUIZ_PARCIAL_PAROU_EM) as [string, ...string[]]),
  ref: z.string().optional().nullable(),
  objetivo: z.enum(vals(OBJETIVO)).optional().nullable(),
  ocupacao: z.enum(vals(OCUPACAO)).optional().nullable(),
  renda_faixa: z.enum(vals(RENDA_FAIXA)).optional().nullable(),
  experiencia_b2b: z.enum(vals(EXPERIENCIA_B2B)).optional().nullable(),
  prioridade: z.enum(vals(PRIORIDADE)).optional().nullable(),
  nome: z.string().min(3).max(160),
  email: z.string().email().max(200),
  telefone: z.string().min(8).max(40),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
  consentimento: z.literal(true),
});

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;
  const db = svc();

  const respostas = {
    objetivo: d.objetivo ?? null,
    ocupacao: d.ocupacao ?? null,
    renda_faixa: d.renda_faixa ?? null,
    experiencia_b2b: d.experiencia_b2b ?? null,
    prioridade: d.prioridade ?? null,
  };
  const parouLabel = QUIZ_PARCIAL_PAROU_EM[d.parou_em];

  const { data: existente } = await db.from("prospeccao_leads")
    .select("id, etapa, metadata")
    .eq("origem", "quiz_partner")
    .eq("metadata->>quiz_session_id", d.session_id)
    .limit(1)
    .maybeSingle();

  if (existente) {
    const meta = (existente.metadata as Record<string, unknown> | null) ?? {};
    // Já concluído: nada a fazer (a conclusão é a fonte da verdade).
    if (meta.quiz_incompleto === false) return NextResponse.json({ ok: true, id: existente.id });
    await db.from("prospeccao_leads").update({
      nome: d.nome.trim(),
      email: d.email.trim(),
      telefone: d.telefone,
      ...(existente.etapa === "incompleto" ? { notas: `Quiz Seja Partner — lead incompleto (parou em ${parouLabel}).` } : {}),
      metadata: { ...meta, ...respostas, quiz_parou_em: d.parou_em, tracking: d.tracking ?? meta.tracking ?? null, parcial_atualizado_em: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq("id", existente.id);
    return NextResponse.json({ ok: true, id: existente.id });
  }

  // Atribuição pelo ?ref=<partner_id>, igual à conclusão.
  let partnerId: string | null = null;
  let partnerName: string | null = null;
  if (d.ref && /^[0-9a-f-]{36}$/i.test(d.ref)) {
    const { data: p } = await db.from("profiles").select("id, full_name, role").eq("id", d.ref).single();
    if (p && PARTNER_ROLES.includes((p as { role?: string }).role ?? "")) {
      partnerId = p.id;
      partnerName = (p as { full_name?: string }).full_name ?? null;
    }
  }

  const { data: lead, error } = await db.from("prospeccao_leads").insert({
    nome: d.nome.trim(),
    email: d.email.trim(),
    telefone: d.telefone,
    origem: "quiz_partner",
    indicado_por_partner_id: partnerId,
    indicado_por_nome: partnerName,
    responsavel_id: null,
    responsavel_nome: null,
    etapa: "incompleto",
    notas: `Quiz Seja Partner — lead incompleto (parou em ${parouLabel}).`,
    created_by: partnerId,
    metadata: {
      form_type: "quiz_partner",
      quiz_versao: 2,
      ...respostas,
      quiz_session_id: d.session_id,
      quiz_incompleto: true,
      quiz_parou_em: d.parou_em,
      ref_partner_id: d.ref ?? null,
      tracking: d.tracking ?? null,
      consentimento: true,
      parcial_criado_em: new Date().toISOString(),
    },
  }).select("id").single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Falha ao registrar" }, { status: 500 });
  }
  await db.from("prospeccao_historico").insert({
    lead_id: lead.id,
    etapa_anterior: null,
    etapa_nova: "incompleto",
    nota: "Quiz Seja Partner — deixou contato e ainda não concluiu",
  });
  return NextResponse.json({ ok: true, id: lead.id });
}
