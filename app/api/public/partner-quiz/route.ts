import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { notifyLeadQuizPartner, notifyQuizPartnerCandidato } from "@/lib/email";
import {
  scoreQuizPartner, PLANO_LABEL,
  OBJETIVO, OCUPACAO, EXPERIENCIA_B2B, REDE, PORTE_REDE, DISPONIBILIDADE, PRAZO_COMECO,
  RENDA_FAIXA,
  type QuizAnswers,
} from "@/lib/quiz-partner";

const RENDA_FAIXA_LABEL: Record<string, string> = Object.fromEntries(
  RENDA_FAIXA.map((o) => [o.value, o.label]),
);

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
  experiencia_b2b: z.enum(vals(EXPERIENCIA_B2B)),
  rede: z.enum(vals(REDE)),
  porte_rede: z.enum(vals(PORTE_REDE)),
  renda_mensal: z.number().nonnegative(),
  renda_faixa: z.string().max(20).optional().nullable(),
  disponibilidade: z.enum(vals(DISPONIBILIDADE)),
  prazo_comeco: z.enum(vals(PRAZO_COMECO)),
  // Passo de contato enxuto: só nome + telefone são obrigatórios; o resto é
  // opcional para reduzir o atrito na hora de finalizar o quiz.
  nome: z.string().min(3),
  email: z.string().email().optional().nullable().or(z.literal("")),
  telefone: z.string().min(8),
  estado: z.string().max(2).optional().nullable(),
  cidade: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
  consentimento: z.literal(true),
});

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];

const LABEL: Record<string, Record<string, string>> = {
  objetivo: Object.fromEntries(OBJETIVO.map((o) => [o.value, o.label])),
  ocupacao: Object.fromEntries(OCUPACAO.map((o) => [o.value, o.label])),
  experiencia_b2b: Object.fromEntries(EXPERIENCIA_B2B.map((o) => [o.value, o.label])),
  rede: Object.fromEntries(REDE.map((o) => [o.value, o.label])),
  porte_rede: Object.fromEntries(PORTE_REDE.map((o) => [o.value, o.label])),
  disponibilidade: Object.fromEntries(DISPONIBILIDADE.map((o) => [o.value, o.label])),
  prazo_comeco: Object.fromEntries(PRAZO_COMECO.map((o) => [o.value, o.label])),
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
    experiencia_b2b: d.experiencia_b2b,
    rede: d.rede,
    porte_rede: d.porte_rede,
    renda_mensal: d.renda_mensal,
    disponibilidade: d.disponibilidade,
    prazo_comeco: d.prazo_comeco,
  };
  const s = scoreQuizPartner(answers);

  const email = d.email && d.email.length ? d.email : null;
  const estado = d.estado && d.estado.length ? d.estado.toUpperCase() : null;
  const cidade = d.cidade && d.cidade.trim().length ? d.cidade.trim() : null;
  const rendaTxt = d.renda_faixa && RENDA_FAIXA_LABEL[d.renda_faixa]
    ? RENDA_FAIXA_LABEL[d.renda_faixa]
    : `R$ ${d.renda_mensal.toLocaleString("pt-BR")}`;

  const resumo =
    `Quiz Seja Partner — faixa ${s.tier} (score ${s.total}), plano sugerido ${PLANO_LABEL[s.plano_sugerido]}. ` +
    `Objetivo: ${LABEL.objetivo[d.objetivo]}. Ocupação: ${LABEL.ocupacao[d.ocupacao]}. ` +
    `Experiência B2B: ${LABEL.experiencia_b2b[d.experiencia_b2b]}. Rede: ${LABEL.rede[d.rede]} decisores, porte ${LABEL.porte_rede[d.porte_rede]}. ` +
    `Renda mensal: ${rendaTxt}. Disponibilidade: ${LABEL.disponibilidade[d.disponibilidade]}. ` +
    `Começar: ${LABEL.prazo_comeco[d.prazo_comeco]}.` +
    (cidade || estado ? ` Local: ${[cidade, estado].filter(Boolean).join("/")}.` : "") +
    (d.instagram ? ` Instagram: ${d.instagram}.` : "") + (d.linkedin ? ` LinkedIn: ${d.linkedin}.` : "") +
    (d.tracking?.utm_source || d.tracking?.utm_campaign
      ? ` Origem: ${[d.tracking?.utm_source, d.tracking?.utm_medium, d.tracking?.utm_campaign].filter(Boolean).join(" / ")}.`
      : "");

  const { data: lead, error } = await db.from("prospeccao_leads").insert({
    nome: d.nome.trim(),
    email,
    telefone: d.telefone,
    cidade,
    estado,
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
      ...answers,
      renda_faixa: d.renda_faixa ?? null,
      instagram: d.instagram ?? null,
      linkedin: d.linkedin ?? null,
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
  const localTxt = cidade || estado ? `\n📍 ${[cidade, estado].filter(Boolean).join("/")}` : "";
  const msgAlerta =
    `🟢 Novo lead — Quiz Seja Partner\n\n` +
    `${d.nome.trim()}\n` +
    `📱 ${d.telefone}` +
    localTxt +
    `\nFaixa ${s.tier} · score ${s.total} · plano ${PLANO_LABEL[s.plano_sugerido]}` +
    origemTxt +
    `\n\nVer: app.v3partners.com.br/prospeccao`;
  const alertNumbers = (process.env.QUIZ_LEAD_ALERT_WHATSAPP || "51997466001")
    .split(",").map((n) => n.trim()).filter(Boolean);

  await Promise.allSettled([
    sendText(d.telefone, msgWhats).catch(() => false),
    ...alertNumbers.map((n) => sendText(n, msgAlerta).catch(() => false)),
    email
      ? notifyQuizPartnerCandidato({
          candidatoEmail: email,
          candidatoNome: d.nome.trim(),
          planoSugerido: PLANO_LABEL[s.plano_sugerido],
        }).catch(() => {})
      : Promise.resolve(),
    notifyLeadQuizPartner({
      nome: d.nome.trim(),
      email: email ?? "—",
      telefone: d.telefone,
      cidade: cidade ?? "—",
      estado: estado ?? "—",
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
