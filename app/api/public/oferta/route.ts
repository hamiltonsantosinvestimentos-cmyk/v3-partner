import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { sendText } from "@/lib/whatsapp/openwa-client";
import { acharLeadPorContato, numerosAlertaQuiz } from "@/lib/quiz-lead-unico";
import { OFERTA, PLANOS_OFERTA, brl, type PlanoOferta } from "@/lib/oferta-trial";

// Pedido dos 30 dias grátis pela LP /oferta (ver lib/oferta-trial.ts). Grava/atualiza o lead na
// Prospecção (coluna "Em Trial"), confirma no WhatsApp do candidato e avisa o time para liberar o
// acesso. A mesma pessoa (e-mail ou WhatsApp) continua sendo um card só.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const schema = z.object({
  nome: z.string().trim().min(3).max(160),
  email: z.string().trim().email().max(200),
  telefone: z.string().min(8).max(40),
  plano: z.enum(PLANOS_OFERTA as [PlanoOferta, ...PlanoOferta[]]).nullable().optional(),
  consentimento: z.literal(true),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Preencha nome, e-mail e WhatsApp." }, { status: 400 });
  const d = parsed.data;
  if (d.telefone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe o WhatsApp com DDD." }, { status: 400 });

  const db = svc();
  const agora = new Date().toISOString();
  const email = d.email.toLowerCase();
  const plano = d.plano ? OFERTA.planos[d.plano] : null;
  const planoTxt = plano ? `${plano.nome} (${brl(plano.preco)}/${plano.periodo}, comissão ${plano.comissao}%)` : "ainda vai escolher";
  const origemTxt = d.tracking?.utm_source || d.tracking?.utm_campaign
    ? [d.tracking?.utm_source, d.tracking?.utm_medium, d.tracking?.utm_campaign].filter(Boolean).join(" / ")
    : "";
  const oferta = { pedido_em: agora, plano_interesse: d.plano ?? null, tracking: d.tracking ?? null };
  const notas = `Oferta única: pediu os ${OFERTA.trialDias} dias grátis pela LP /oferta. Plano de interesse depois do trial: ${planoTxt}.` +
    (origemTxt ? ` Origem: ${origemTxt}.` : "");

  const existente = await acharLeadPorContato(db, { email, telefone: d.telefone });
  let leadId: string;
  if (existente) {
    // Quem já é partner (convertido) não volta para o trial.
    const mover = existente.etapa !== "convertido" && existente.etapa !== "trial";
    const { error } = await db.from("prospeccao_leads").update({
      nome: d.nome, email, telefone: d.telefone, notas,
      ...(mover ? { etapa: "trial" } : {}),
      metadata: { ...(existente.metadata ?? {}), oferta_trial: oferta },
      updated_at: agora,
    }).eq("id", existente.id);
    if (error) return NextResponse.json({ error: "Não foi possível registrar. Tente novamente." }, { status: 500 });
    leadId = existente.id;
    await db.from("prospeccao_historico").insert({
      lead_id: leadId, etapa_anterior: mover ? existente.etapa : null, etapa_nova: mover ? "trial" : null,
      nota: `Pediu os ${OFERTA.trialDias} dias grátis pela LP /oferta (já estava na Prospecção, mesmo card).`,
    }).then(null, () => {});
  } else {
    const { data, error } = await db.from("prospeccao_leads").insert({
      nome: d.nome, email, telefone: d.telefone,
      origem: "oferta_trial", etapa: "trial", notas,
      metadata: { form_type: "oferta_trial", consentimento: true, tracking: d.tracking ?? null, oferta_trial: oferta },
    }).select("id").single();
    if (error || !data) return NextResponse.json({ error: "Não foi possível registrar. Tente novamente." }, { status: 500 });
    leadId = data.id;
    await db.from("prospeccao_historico").insert({
      lead_id: leadId, etapa_anterior: null, etapa_nova: "trial",
      nota: `Pediu os ${OFERTA.trialDias} dias grátis pela LP /oferta.`,
    }).then(null, () => {});
  }

  const primeiroNome = d.nome.split(/\s+/)[0] || d.nome;
  const msgLead =
    `Olá, ${primeiroNome}! 👋\n\n` +
    `Recebemos seu pedido dos ${OFERTA.trialDias} dias grátis na V3 Partners. ` +
    `Nossa equipe vai te chamar aqui para liberar o seu acesso à plataforma.\n\n` +
    `Depois do período grátis você escolhe o seu plano, ou cancela sem custo.\n— V3 Partners`;
  const msgAlerta =
    `🟣 Pedido de TRIAL 30 dias — LP /oferta\n\n` +
    `${d.nome}\n📱 ${d.telefone}\n✉️ ${email}\n` +
    `Plano de interesse: ${planoTxt}` +
    (origemTxt ? `\nOrigem: ${origemTxt}` : "") +
    (existente ? `\n↺ Já estava na Prospecção: mesmo card` : "") +
    `\n\nLiberar o acesso: app.v3partners.com.br/prospeccao`;

  await Promise.allSettled([
    sendText(d.telefone, msgLead).catch(() => false),
    ...numerosAlertaQuiz().map((n) => sendText(n, msgAlerta).catch(() => false)),
  ]);

  return NextResponse.json({ ok: true });
}
