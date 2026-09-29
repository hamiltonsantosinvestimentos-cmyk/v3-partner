import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { notifyLeadQuizPartner, notifyQuizPartnerCandidato } from "@/lib/email";
import {
  scoreQuizPartner, PLANO_LABEL,
  OBJETIVO, OCUPACAO, RENDA_FAIXA, RENDA_FAIXA_VALOR, EXPERIENCIA_B2B, PRIORIDADE, INVESTIMENTO,
  type QuizAnswers,
} from "@/lib/quiz-partner";

// Quiz público "Seja Partner" (/seja-partner). Grava um lead qualificado em
// prospeccao_leads (mesma aba Prospecção Partners), com score calculado AQUI
// (nunca confia no client), plano sugerido e etapa pela faixa. Notifica o time
// e manda WhatsApp + e-mail de confirmação pro candidato. Todos os leads —
// independente da faixa A/B/C — entram na Prospecção; a faixa só muda a etapa
// de entrada e a urgência do contato.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const vals = (opts: { value: string }[]) => opts.map((o) => o.value) as [string, ...string[]];

const schema = z.object({
  ref: z.string().optional().nullable(),
  objetivo: z.enum(vals(OBJETIVO)),
  ocupacao: z.enum(vals(OCUPACAO)),
  renda_faixa: z.enum(vals(RENDA_FAIXA)),
  experiencia_b2b: z.enum(vals(EXPERIENCIA_B2B)),
  prioridade: z.enum(vals(PRIORIDADE)),
  investimento: z.enum(vals(INVESTIMENTO)),
  nome: z.string().min(3),
  email: z.string().email(),
  telefone: z.string().min(8),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
  consentimento: z.literal(true),
});

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const LABEL: Record<string, Record<string, string>> = {
  objetivo: Object.fromEntries(OBJETIVO.map((o) => [o.value, o.label])),
  ocupacao: Object.fromEntries(OCUPACAO.map((o) => [o.value, o.label])),
  renda_faixa: Object.fromEntries(RENDA_FAIXA.map((o) => [o.value, o.label])),
  experiencia_b2b: Object.fromEntries(EXPERIENCIA_B2B.map((o) => [o.value, o.label])),
  prioridade: Object.fromEntries(PRIORIDADE.map((o) => [o.value, o.label])),
  investimento: Object.fromEntries(INVESTIMENTO.map((o) => [o.value, o.label])),
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.data ? "Dados inválidos" : "JSON inválido", details: parsed.error?.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const db = svc();

  // Atribuição pelo ?ref=<partner_id> (partner recrutando sub-partner).
  let partnerId: string | null = null;
  let partnerName: string | null = null;
  if (d.ref && /^[0-9a-f-]{36}$/i.test(d.ref)) {
    const { data: p } = await db.from("profiles").select("id, full_name, role").eq("id", d.ref).single();
    if (p && PARTNER_ROLES.includes((p as { role?: string }).role ?? "")) {
      partnerId = p.id;
      partnerName = (p as { full_name?: string }).full_name ?? null;
    }
  }

  const answers: QuizAnswers = {
    objetivo: d.objetivo,
    ocupacao: d.ocupacao,
    renda_faixa: d.renda_faixa,
    experiencia_b2b: d.experiencia_b2b,
    prioridade: d.prioridade,
    investimento: d.investimento,
  };
  const s = scoreQuizPartner(answers);

  const email = d.email.trim();

  const resumo =
    `Quiz Seja Partner — faixa ${s.tier} (score ${s.total}), plano sugerido ${PLANO_LABEL[s.plano_sugerido]}. ` +
    `Objetivo: ${LABEL.objetivo[d.objetivo]}. Ocupação: ${LABEL.ocupacao[d.ocupacao]}. ` +
    `Renda mensal: ${LABEL.renda_faixa[d.renda_faixa]}. Experiência B2B: ${LABEL.experiencia_b2b[d.experiencia_b2b]}. ` +
    `Prioridade: ${LABEL.prioridade[d.prioridade]}. Investimento: ${LABEL.investimento[d.investimento]}.` +
    (d.tracking?.utm_source || d.tracking?.utm_campaign
      ? ` Origem: ${[d.tracking?.utm_source, d.tracking?.utm_medium, d.tracking?.utm_campaign].filter(Boolean).join(" / ")}.`
      : "");

  const { data: lead, error } = await db.from("prospeccao_leads").insert({
    nome: d.nome.trim(),
    email,
    telefone: d.telefone,
    origem: "quiz_partner",
    indicado_por_partner_id: partnerId,
    indicado_por_nome: partnerName,
    responsavel_id: null,
    responsavel_nome: null,
    etapa: s.etapa,
    notas: resumo,
    score: s.total,
    plano_sugerido: s.plano_sugerido,
    created_by: partnerId,
    metadata: {
      form_type: "quiz_partner",
      quiz_versao: 2,
      ...answers,
      renda_mensal: RENDA_FAIXA_VALOR[d.renda_faixa] ?? 0,
      score_total: s.total,
      score_breakdown: s.breakdown,
      tier: s.tier,
      plano_sugerido: s.plano_sugerido,
      ref_partner_id: d.ref ?? null,
      tracking: d.tracking ?? null,
      consentimento: true,
      submitted_at: new Date().toISOString(),
    },
  }).select("id").single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Falha ao registrar o quiz" }, { status: 500 });
  }

  // Confirmação pro candidato (WhatsApp + e-mail) + aviso pro time. Nunca
  // reverte/falha a requisição — o lead já está gravado.
  const primeiroNome = d.nome.trim().split(/\s+/)[0] || d.nome.trim();
  const msgWhats =
    `Olá, ${primeiroNome}! 👋\n\n` +
    `Recebemos seu interesse em se tornar Partner da V3. ` +
    `Nossa equipe já vai te chamar aqui pelo WhatsApp para conversar sobre os próximos passos.\n\n` +
    `Plano sugerido pelo seu perfil: ${PLANO_LABEL[s.plano_sugerido]}.\n— V3 Partners`;

  // Alerta interno no WhatsApp assim que o lead entra. Número configurável por
  // env (QUIZ_LEAD_ALERT_WHATSAPP, aceita 1+ números separados por vírgula);
  // fallback pro número do time.
  const origemTxt =
    d.tracking?.utm_source || d.tracking?.utm_campaign
      ? `\nOrigem: ${[d.tracking?.utm_source, d.tracking?.utm_medium, d.tracking?.utm_campaign].filter(Boolean).join(" / ")}`
      : "";
  const msgAlerta =
    `🟢 Novo lead — Quiz Seja Partner\n\n` +
    `${d.nome.trim()}\n` +
    `📱 ${d.telefone}` +
    `\n✉️ ${email}` +
    `\nInvestimento: ${LABEL.investimento[d.investimento]}` +
    `\nPrioridade: ${LABEL.prioridade[d.prioridade]}` +
    `\nFaixa ${s.tier} · score ${s.total} · plano ${PLANO_LABEL[s.plano_sugerido]}` +
    origemTxt +
    `\n\nVer: app.v3partners.com.br/prospeccao`;
  const alertNumbers = (process.env.QUIZ_LEAD_ALERT_WHATSAPP || "51997466001")
    .split(",").map((n) => n.trim()).filter(Boolean);

  await Promise.allSettled([
    sendText(d.telefone, msgWhats).catch(() => false),
    ...alertNumbers.map((n) => sendText(n, msgAlerta).catch(() => false)),
    notifyQuizPartnerCandidato({
      candidatoEmail: email,
      candidatoNome: d.nome.trim(),
      planoSugerido: PLANO_LABEL[s.plano_sugerido],
    }).catch(() => {}),
    notifyLeadQuizPartner({
      nome: d.nome.trim(),
      email,
      telefone: d.telefone,
      cidade: "—",
      estado: "—",
      tier: s.tier,
      score: s.total,
      planoSugerido: PLANO_LABEL[s.plano_sugerido],
      resumo,
      indicadoPor: partnerName,
    }).catch(() => {}),
  ]);

  return NextResponse.json({
    ok: true,
    tier: s.tier,
    planoSugerido: s.plano_sugerido,
    planoLabel: PLANO_LABEL[s.plano_sugerido],
  });
}
