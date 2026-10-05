import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { notifyLeadQuizPartner, notifyQuizPartnerCandidato } from "@/lib/email";
import { PLANO_LABEL } from "@/lib/quiz-partner";
import {
  classificarWhiteLabel, WL_LISTA_LABEL,
  WL_OBJETIVO, WL_CAPITAL, WL_DEDICACAO, WL_EXPERIENCIA, WL_PRAZO,
  type WlAnswers,
} from "@/lib/quiz-white-label";

// Quiz público "White Label" (/white-label). Mesmo caminho do quiz Seja Partner: grava o lead em
// prospeccao_leads (origem quiz_white_label) com a lista Hot/Warm/Cold calculada AQUI, completa o
// lead parcial da sessão se existir, avisa o time (WhatsApp + e-mail) e confirma ao candidato.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const vals = (opts: { value: string }[]) => opts.map((o) => o.value) as [string, ...string[]];

const schema = z.object({
  ref: z.string().optional().nullable(),
  objetivo: z.enum(vals(WL_OBJETIVO)),
  capital: z.enum(vals(WL_CAPITAL)),
  dedicacao: z.enum(vals(WL_DEDICACAO)),
  experiencia: z.enum(vals(WL_EXPERIENCIA)),
  prazo: z.enum(vals(WL_PRAZO)),
  nome: z.string().min(3),
  email: z.string().email(),
  telefone: z.string().min(8),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
  consentimento: z.literal(true),
  session_id: z.string().max(80).optional().nullable(),
});

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const LABEL: Record<string, Record<string, string>> = {
  objetivo: Object.fromEntries(WL_OBJETIVO.map((o) => [o.value, o.label])),
  capital: Object.fromEntries(WL_CAPITAL.map((o) => [o.value, o.label])),
  dedicacao: Object.fromEntries(WL_DEDICACAO.map((o) => [o.value, o.label])),
  experiencia: Object.fromEntries(WL_EXPERIENCIA.map((o) => [o.value, o.label])),
  prazo: Object.fromEntries(WL_PRAZO.map((o) => [o.value, `${o.label}${o.hint ? ` (${o.hint})` : ""}`])),
};

const ACAO: Record<string, string> = {
  hot: "encaminhar já para fechamento com executivo comercial/consultor sênior",
  warm: "sequência de nutrição (e-mail/WhatsApp), convite para apresentação institucional e reunião futura",
  cold: "direcionar para oferta de menor ticket (entrada como Partner padrão)",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;
  const db = svc();

  let partnerId: string | null = null;
  let partnerName: string | null = null;
  if (d.ref && /^[0-9a-f-]{36}$/i.test(d.ref)) {
    const { data: p } = await db.from("profiles").select("id, full_name, role").eq("id", d.ref).single();
    if (p && PARTNER_ROLES.includes((p as { role?: string }).role ?? "")) {
      partnerId = p.id;
      partnerName = (p as { full_name?: string }).full_name ?? null;
    }
  }

  const answers: WlAnswers = { objetivo: d.objetivo, capital: d.capital, dedicacao: d.dedicacao, experiencia: d.experiencia, prazo: d.prazo };
  const s = classificarWhiteLabel(answers);
  const email = d.email.trim();
  const origemTrafego = d.tracking?.utm_source || d.tracking?.utm_campaign
    ? [d.tracking?.utm_source, d.tracking?.utm_medium, d.tracking?.utm_campaign].filter(Boolean).join(" / ")
    : null;

  const resumo =
    `Quiz White Label — ${WL_LISTA_LABEL[s.lista]} (score ${s.total}). Ação: ${ACAO[s.lista]}. ` +
    `Objetivo: ${LABEL.objetivo[d.objetivo]}. Capital: ${LABEL.capital[d.capital]}. Dedicação: ${LABEL.dedicacao[d.dedicacao]}. ` +
    `Experiência: ${LABEL.experiencia[d.experiencia]}. Prazo: ${LABEL.prazo[d.prazo]}.` +
    (origemTrafego ? ` Origem: ${origemTrafego}.` : "");

  const metadata = {
    form_type: "quiz_white_label",
    quiz_versao: 1,
    ...answers,
    lista: s.lista,
    score_total: s.total,
    score_breakdown: s.breakdown,
    tier: s.tier,
    plano_sugerido: s.plano_sugerido,
    ref_partner_id: d.ref ?? null,
    tracking: d.tracking ?? null,
    consentimento: true,
    quiz_session_id: d.session_id ?? null,
    quiz_incompleto: false,
    quiz_parou_em: null,
    submitted_at: new Date().toISOString(),
  };

  type LeadParcial = { id: string; etapa: string; metadata: Record<string, unknown> | null };
  let existente: LeadParcial | null = null;
  if (d.session_id) {
    const { data } = await db.from("prospeccao_leads")
      .select("id, etapa, metadata")
      .eq("origem", "quiz_white_label")
      .eq("metadata->>quiz_session_id", d.session_id)
      .limit(1)
      .maybeSingle();
    existente = (data as LeadParcial | null) ?? null;
  }

  const campos = {
    nome: d.nome.trim(),
    email,
    telefone: d.telefone,
    indicado_por_partner_id: partnerId,
    indicado_por_nome: partnerName,
    notas: resumo,
    score: s.total,
    plano_sugerido: s.plano_sugerido,
  };

  let lead: { id: string } | null = null;
  let error: { message: string } | null = null;
  if (existente) {
    const novaEtapa = existente.etapa === "incompleto" ? s.etapa : existente.etapa;
    const r = await db.from("prospeccao_leads").update({
      ...campos,
      etapa: novaEtapa,
      metadata: { ...(existente.metadata ?? {}), ...metadata },
      updated_at: new Date().toISOString(),
    }).eq("id", existente.id).select("id").single();
    lead = r.data; error = r.error;
    if (!error && existente.etapa === "incompleto") {
      await db.from("prospeccao_historico").insert({
        lead_id: existente.id,
        etapa_anterior: "incompleto",
        etapa_nova: novaEtapa,
        nota: "Quiz White Label concluído — lead completo",
      });
    }
  } else {
    const r = await db.from("prospeccao_leads").insert({
      ...campos,
      origem: "quiz_white_label",
      responsavel_id: null,
      responsavel_nome: null,
      etapa: s.etapa,
      created_by: partnerId,
      metadata,
    }).select("id").single();
    lead = r.data; error = r.error;
  }

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Falha ao registrar o quiz" }, { status: 500 });
  }

  const primeiroNome = d.nome.trim().split(/\s+/)[0] || d.nome.trim();
  const msgWhats = s.lista === "cold"
    ? `Olá, ${primeiroNome}! 👋\n\nRecebemos sua aplicação para o White Label da V3. ` +
      `Pelo seu momento, o melhor caminho para começar é o modelo Partner V3, com investimento menor. ` +
      `Nossa equipe vai te mandar os detalhes por aqui.\n— V3 Partners`
    : `Olá, ${primeiroNome}! 👋\n\nRecebemos sua aplicação para o White Label da V3 (sua própria empresa de crédito, com a sua marca). ` +
      `Um executivo da V3 vai falar com você aqui pelo WhatsApp para os próximos passos.\n— V3 Partners`;

  const emoji = s.lista === "hot" ? "🔥" : s.lista === "warm" ? "🌡️" : "❄️";
  const msgAlerta =
    `${emoji} Novo lead — Quiz White Label (${s.lista.toUpperCase()})\n\n` +
    `${d.nome.trim()}\n📱 ${d.telefone}\n✉️ ${email}` +
    `\nCapital: ${LABEL.capital[d.capital]}` +
    `\nPrazo: ${LABEL.prazo[d.prazo]}` +
    `\n${WL_LISTA_LABEL[s.lista]} · score ${s.total}` +
    `\nAção: ${ACAO[s.lista]}` +
    (origemTrafego ? `\nOrigem: ${origemTrafego}` : "") +
    `\n\nVer: app.v3partners.com.br/prospeccao`;
  const alertNumbers = (process.env.QUIZ_LEAD_ALERT_WHATSAPP || "51997466001,+97433006127")
    .split(",").map((n) => n.trim()).filter(Boolean);

  await Promise.allSettled([
    sendText(d.telefone, msgWhats).catch(() => false),
    ...alertNumbers.map((n) => sendText(n, msgAlerta).catch(() => false)),
    notifyQuizPartnerCandidato({
      candidatoEmail: email,
      candidatoNome: d.nome.trim(),
      planoSugerido: s.lista === "cold" ? PLANO_LABEL.PARTNER : "White Label (V3 Enterprise)",
      quiz: "White Label",
    }).catch(() => {}),
    notifyLeadQuizPartner({
      nome: d.nome.trim(),
      email,
      telefone: d.telefone,
      cidade: "—",
      estado: "—",
      tier: s.tier,
      score: s.total,
      planoSugerido: s.lista === "cold" ? PLANO_LABEL.PARTNER : "White Label (V3 Enterprise)",
      resumo,
      indicadoPor: partnerName,
      quiz: "White Label",
    }).catch(() => {}),
  ]);

  return NextResponse.json({ ok: true, lista: s.lista, tier: s.tier });
}
