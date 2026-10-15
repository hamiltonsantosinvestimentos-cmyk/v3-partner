import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import {
  WEBINAR, confirmarPagamentoWebinar, faturaPaga, inscricoesAbertas, leadPorTelefone, leadPorToken,
  novoToken, salvarWebinar, webinarDe, type WebinarMeta,
} from "@/lib/webinar";

// Inscrição no webinar (ver lib/webinar.ts).
//   POST { nome, telefone, consentimento, tracking? } → { token }  (cria/atualiza o lead na Prospecção)
//   GET  ?t=<token> → estado do checkout (status, Pix/boleto já gerado); se a fatura existe e
//        ainda não consta paga, consulta a Cora (no máximo a cada 10 s por inscrição).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const schema = z.object({
  nome: z.string().trim().min(3).max(160),
  telefone: z.string().min(8).max(40),
  consentimento: z.literal(true),
  tracking: z.record(z.string(), z.string().max(300)).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Preencha nome e WhatsApp." }, { status: 400 });
  if (!inscricoesAbertas()) return NextResponse.json({ error: "As inscrições para este webinar estão encerradas." }, { status: 410 });
  const d = parsed.data;
  if (d.telefone.replace(/\D/g, "").length < 10) return NextResponse.json({ error: "Informe o WhatsApp com DDD." }, { status: 400 });
  const db = svc();
  const agora = new Date().toISOString();

  // A mesma pessoa (mesmo WhatsApp) é um lead só: retoma a inscrição que já existe.
  const existente = await leadPorTelefone(db, d.telefone);
  if (existente) {
    const w = webinarDe(existente);
    if (w) return NextResponse.json({ token: w.token });
    const webinar: WebinarMeta = { token: novoToken(), status: "aguardando", nome: d.nome, criado_em: agora, tracking: d.tracking ?? null };
    await db.from("prospeccao_leads").update({
      metadata: { ...(existente.metadata ?? {}), webinar },
      updated_at: agora,
    }).eq("id", existente.id);
    await db.from("prospeccao_historico").insert({
      lead_id: existente.id, etapa_anterior: null, etapa_nova: null,
      nota: `Webinar ${WEBINAR.dataLabel}: começou a inscrição.`,
    }).then(null, () => {});
    return NextResponse.json({ token: webinar.token });
  }

  const webinar: WebinarMeta = { token: novoToken(), status: "aguardando", nome: d.nome, criado_em: agora, tracking: d.tracking ?? null };
  const { data: lead, error } = await db.from("prospeccao_leads").insert({
    nome: d.nome,
    telefone: d.telefone,
    origem: "webinar",
    etapa: "prospect",
    notas: `Webinar ${WEBINAR.titulo} (${WEBINAR.dataLabel}) — inscrição pela LP /webinar.`,
    metadata: { form_type: "webinar", consentimento: true, tracking: d.tracking ?? null, webinar },
  }).select("id").single();
  if (error || !lead) return NextResponse.json({ error: "Não foi possível registrar. Tente novamente." }, { status: 500 });
  await db.from("prospeccao_historico").insert({
    lead_id: lead.id, etapa_anterior: null, etapa_nova: "prospect",
    nota: `Webinar ${WEBINAR.dataLabel}: começou a inscrição.`,
  }).then(null, () => {});
  return NextResponse.json({ token: webinar.token });
}

export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("t") ?? "";
  const db = svc();
  const lead = await leadPorToken(db, token);
  const w = lead && webinarDe(lead);
  if (!lead || !w) return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });

  let status = w.status;
  const ultima = w.consultado_cora_em ? new Date(w.consultado_cora_em).getTime() : 0;
  if (status !== "pago" && w.cora_invoice_id && Date.now() - ultima > 10_000) {
    await salvarWebinar(db, lead.id, (a) => ({ ...a, consultado_cora_em: new Date().toISOString() }));
    if (await faturaPaga(w.cora_invoice_id)) {
      await confirmarPagamentoWebinar(db, lead.id);
      status = "pago";
    }
  }

  // Sem o nome: o token sai de um WhatsApp digitado na LP, e o lead pode ser de outra origem.
  return NextResponse.json({
    status,
    // Link do grupo só para inscrição paga.
    grupo_url: status === "pago" ? WEBINAR.grupoUrl : null,
    abertas: inscricoesAbertas(),
    forma: w.forma ?? null,
    vencimento: w.vencimento ?? null,
    pix_emv: w.pix_emv ?? null,
    pix_qr_code: w.pix_qr_code ?? null,
    boleto_barcode: w.boleto_barcode ?? null,
    boleto_pdf: w.boleto_pdf ?? null,
    tem_cpf: !!w.cpf,
  });
}
