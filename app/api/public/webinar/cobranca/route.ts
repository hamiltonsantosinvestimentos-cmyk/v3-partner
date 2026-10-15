import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { coraFetch } from "@/lib/cora";
import { isValidCPF } from "@/lib/validators/cpf-cnpj";
import { WEBINAR, inscricoesAbertas, leadPorToken, salvarWebinar, webinarDe, type WebinarMeta } from "@/lib/webinar";

// POST { t, cpf, forma } → gera (ou reaproveita) a fatura Cora do ingresso do webinar, com Pix e
// boleto. A Cora exige o CPF do pagador na fatura, por isso ele é pedido aqui e não na LP.
// Ver lib/webinar.ts.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const schema = z.object({
  t: z.string().regex(/^[0-9a-f]{32}$/),
  cpf: z.string().max(20),
  forma: z.enum(["pix", "boleto"]),
});

function hojeSP(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  const { t, forma } = parsed.data;
  const cpf = parsed.data.cpf.replace(/\D/g, "");
  if (!isValidCPF(cpf)) return NextResponse.json({ error: "CPF inválido." }, { status: 400 });
  if (!inscricoesAbertas()) return NextResponse.json({ error: "As inscrições para este webinar estão encerradas." }, { status: 410 });

  const db = svc();
  const lead = await leadPorToken(db, t);
  const w = lead && webinarDe(lead);
  if (!lead || !w) return NextResponse.json({ error: "Inscrição não encontrada." }, { status: 404 });
  if (w.status === "pago") return NextResponse.json({ status: "pago", grupo_url: WEBINAR.grupoUrl });

  // Fatura do mesmo CPF ainda no prazo: só troca a forma exibida (a fatura já tem Pix e boleto).
  if (w.cora_invoice_id && w.cpf === cpf && w.vencimento && w.vencimento >= hojeSP()) {
    const atual = await salvarWebinar(db, lead.id, (a) => ({ ...a, forma }));
    return NextResponse.json(resposta(atual));
  }

  // Vencimento: D+2, sem passar do dia do evento.
  const d2 = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const diaEvento = WEBINAR.inicioISO.slice(0, 10);
  const vencimento = d2 < diaEvento ? d2 : diaEvento;
  const nomeServico = `Ingresso webinar ${WEBINAR.titulo} (${WEBINAR.dataLabel})`;

  let cora: {
    id?: string;
    pix?: { emv?: string; qr_code?: string };
    payment_options?: { bank_slip?: { digitable?: string; url?: string } };
  };
  try {
    const res = await coraFetch("/v2/invoices", {
      method: "POST",
      body: JSON.stringify({
        code: `WEB-${t.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`,
        customer: { name: (w.nome ?? lead.nome).trim(), document: { identity: cpf, type: "CPF" } },
        payment_terms: { due_date: vencimento, amount: WEBINAR.precoCents },
        payment_forms: ["BANK_SLIP", "PIX"],
        services: [{ name: nomeServico, amount: WEBINAR.precoCents }],
      }),
      idempotencyKey: `webinar-${t}-${cpf}-${vencimento}`,
    });
    if (!res.ok) {
      console.error("Cora webinar:", res.status, await res.json().catch(() => ({})));
      return NextResponse.json({ error: "Não foi possível gerar a cobrança. Tente novamente em instantes." }, { status: 502 });
    }
    cora = (await res.json()) as typeof cora;
  } catch (e) {
    console.error("Cora webinar:", e);
    return NextResponse.json({ error: "Não foi possível gerar a cobrança. Tente novamente em instantes." }, { status: 502 });
  }

  const atual = await salvarWebinar(db, lead.id, (a) => ({
    ...a,
    cpf,
    forma,
    cora_invoice_id: cora.id,
    cobranca_gerada_em: new Date().toISOString(),
    vencimento,
    pix_emv: cora.pix?.emv ?? null,
    pix_qr_code: cora.pix?.qr_code ?? null,
    boleto_barcode: cora.payment_options?.bank_slip?.digitable ?? null,
    boleto_pdf: cora.payment_options?.bank_slip?.url ?? null,
  }));
  return NextResponse.json(resposta(atual));
}

function resposta(w: WebinarMeta) {
  return {
    status: w.status,
    forma: w.forma ?? null,
    vencimento: w.vencimento ?? null,
    pix_emv: w.pix_emv ?? null,
    pix_qr_code: w.pix_qr_code ?? null,
    boleto_barcode: w.boleto_barcode ?? null,
    boleto_pdf: w.boleto_pdf ?? null,
  };
}
