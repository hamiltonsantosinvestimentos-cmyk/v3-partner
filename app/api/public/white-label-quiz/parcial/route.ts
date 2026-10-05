import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { sendText } from "@/lib/whatsapp/openwa-client";
import {
  WL_OBJETIVO, WL_CAPITAL, WL_DEDICACAO, WL_EXPERIENCIA, WL_PARCIAL_PAROU_EM,
} from "@/lib/quiz-white-label";

// Lead PARCIAL do quiz "White Label" (/white-label). Chamado pelo client assim que o candidato deixa
// nome + WhatsApp + e-mail (com consentimento LGPD) e a cada passo seguinte. Cria/atualiza um lead
// em prospeccao_leads na etapa "incompleto" (coluna "Lead incompleto" do Kanban), casado pela sessão.
// Diferente do Seja Partner, o lead incompleto também avisa o time no WhatsApp (decisão do Hamilton,
// 05/10/2026), uma vez só, na criação. A conclusão (../route.ts) completa ESTE mesmo lead.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const vals = (opts: { value: string }[]) => opts.map((o) => o.value) as [string, ...string[]];

const schema = z.object({
  session_id: z.string().min(8).max(80),
  parou_em: z.enum(Object.keys(WL_PARCIAL_PAROU_EM) as [string, ...string[]]),
  ref: z.string().optional().nullable(),
  objetivo: z.enum(vals(WL_OBJETIVO)).optional().nullable(),
  capital: z.enum(vals(WL_CAPITAL)).optional().nullable(),
  dedicacao: z.enum(vals(WL_DEDICACAO)).optional().nullable(),
  experiencia: z.enum(vals(WL_EXPERIENCIA)).optional().nullable(),
  nome: z.string().min(3).max(160),
  email: z.string().email().max(200),
  telefone: z.string().min(8).max(40),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
  consentimento: z.literal(true),
});

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const LABEL_CAPITAL = Object.fromEntries(WL_CAPITAL.map((o) => [o.value, o.label]));

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
    capital: d.capital ?? null,
    dedicacao: d.dedicacao ?? null,
    experiencia: d.experiencia ?? null,
  };
  const parouLabel = WL_PARCIAL_PAROU_EM[d.parou_em];

  const { data: existente } = await db.from("prospeccao_leads")
    .select("id, etapa, metadata")
    .eq("origem", "quiz_white_label")
    .eq("metadata->>quiz_session_id", d.session_id)
    .limit(1)
    .maybeSingle();

  if (existente) {
    const meta = (existente.metadata as Record<string, unknown> | null) ?? {};
    if (meta.quiz_incompleto === false) return NextResponse.json({ ok: true, id: existente.id });
    await db.from("prospeccao_leads").update({
      nome: d.nome.trim(),
      email: d.email.trim(),
      telefone: d.telefone,
      ...(existente.etapa === "incompleto" ? { notas: `Quiz White Label — lead incompleto (parou em ${parouLabel}).` } : {}),
      metadata: { ...meta, ...respostas, quiz_parou_em: d.parou_em, tracking: d.tracking ?? meta.tracking ?? null, parcial_atualizado_em: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    }).eq("id", existente.id);
    return NextResponse.json({ ok: true, id: existente.id });
  }

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
    origem: "quiz_white_label",
    indicado_por_partner_id: partnerId,
    indicado_por_nome: partnerName,
    responsavel_id: null,
    responsavel_nome: null,
    etapa: "incompleto",
    notas: `Quiz White Label — lead incompleto (parou em ${parouLabel}).`,
    created_by: partnerId,
    metadata: {
      form_type: "quiz_white_label",
      quiz_versao: 1,
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
    nota: "Quiz White Label — deixou contato e ainda não concluiu",
  });

  // Aviso ao time no WhatsApp: lead incompleto já pode ser chamado.
  const origemTrafego = d.tracking?.utm_source || d.tracking?.utm_campaign
    ? [d.tracking?.utm_source, d.tracking?.utm_medium, d.tracking?.utm_campaign].filter(Boolean).join(" / ")
    : null;
  const msgAlerta =
    `🟡 Lead incompleto — Quiz White Label\n\n` +
    `${d.nome.trim()}\n📱 ${d.telefone}\n✉️ ${d.email.trim()}` +
    (d.capital ? `\nCapital: ${LABEL_CAPITAL[d.capital]}` : "") +
    `\nParou em: ${parouLabel}` +
    (origemTrafego ? `\nOrigem: ${origemTrafego}` : "") +
    `\n\nVer: app.v3partners.com.br/prospeccao`;
  const alertNumbers = (process.env.QUIZ_LEAD_ALERT_WHATSAPP || "51997466001,+97433006127")
    .split(",").map((n) => n.trim()).filter(Boolean);
  await Promise.allSettled(alertNumbers.map((n) => sendText(n, msgAlerta).catch(() => false)));

  return NextResponse.json({ ok: true, id: lead.id });
}
