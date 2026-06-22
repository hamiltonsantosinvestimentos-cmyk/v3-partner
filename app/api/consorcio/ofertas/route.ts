import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const ofertaSchema = z.object({
  carta_id: z.string().uuid(),
  carta_code: z.string().min(1),
  carta_credit_value: z.number().positive(),
  interessado_nome: z.string().min(1).max(200),
  interessado_tel: z.string().max(30).optional().nullable(),
  valor_oferta: z.number().positive(),
  observacoes: z.string().max(2000).optional().nullable(),
  responsavel_id: z.string().uuid().optional().nullable(),
});

export async function POST(req: NextRequest) {
  // Auth
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = ofertaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  // Busca responsável (nome) se informado
  let responsavel_nome: string | null = null;
  if (d.responsavel_id) {
    const { data: resp } = await svc()
      .from("profiles")
      .select("full_name")
      .eq("id", d.responsavel_id)
      .single();
    responsavel_nome = resp?.full_name ?? null;
  }

  // 1. Inserir oferta em consorcio_ofertas (service_role bypassa RLS)
  const { data: oferta, error: ofertaError } = await svc()
    .from("consorcio_ofertas")
    .insert({
      carta_id: d.carta_id,
      carta_code: d.carta_code,
      carta_credit_value: d.carta_credit_value,
      interessado_nome: d.interessado_nome,
      interessado_tel: d.interessado_tel ?? null,
      valor_oferta: d.valor_oferta,
      observacoes: d.observacoes ?? null,
      responsavel_id: d.responsavel_id ?? null,
      responsavel_nome,
      created_by: user.id,
    })
    .select()
    .single();

  if (ofertaError) {
    return NextResponse.json({ error: `Erro ao registrar oferta: ${ofertaError.message}` }, { status: 500 });
  }

  // 2. Atualizar status da carta para NEGOCIACAO
  await svc()
    .from("consorcio_cartas")
    .update({ status: "NEGOCIACAO" })
    .eq("id", d.carta_id);

  // 3. Buscar todos os admins/gestão para notificações e email
  const { data: admins } = await svc()
    .from("profiles")
    .select("id, email, full_name")
    .in("role", ["ADMIN", "GESTAO"])
    .eq("is_active", true);

  // 4. Notificações in-app
  if (admins && admins.length > 0) {
    await svc().from("notifications").insert(
      admins.map((a: { id: string; email: string; full_name: string }) => ({
        user_id: a.id,
        title: "Nova Oferta de Consórcio",
        message: `${d.interessado_nome} fez uma oferta de ${fmtCurrency(d.valor_oferta)} para a carta ${d.carta_code} (crédito ${fmtCurrency(d.carta_credit_value)}).`,
        type: "CONSORCIO_OFERTA",
        action_url: "/consorcio/cartas-contempladas",
        read: false,
      }))
    );
  }

  // 5. Email via Resend para todos os admins
  if (process.env.RESEND_API_KEY && admins && admins.length > 0) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const adminEmails = admins
        .map((a: { id: string; email: string; full_name: string }) => a.email)
        .filter(Boolean) as string[];

      if (adminEmails.length > 0) {
        const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Nova Oferta de Consórcio</title></head>
<body style="margin:0;padding:0;background:#07101E;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#0C1929;border-radius:12px;overflow:hidden;border:1px solid #1B3050;">
    <div style="padding:24px 32px;border-bottom:1px solid #1B3050;background:#07101E;">
      <span style="font-size:16px;font-weight:800;color:#E5B96A;letter-spacing:0.08em;">V3 PARTNERS</span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#C8D4E3;">
        Nova Oferta — Carta ${d.carta_code}
      </h2>
      <div style="background:#07101E;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Carta</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${d.carta_code}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Valor do Crédito</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${fmtCurrency(d.carta_credit_value)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Valor da Oferta</span>
          <span style="color:#E5B96A;font-size:13px;font-weight:700;">${fmtCurrency(d.valor_oferta)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1B3050;">
          <span style="color:#7A96AF;font-size:13px;">Interessado</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${d.interessado_nome}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:${d.observacoes ? "1px solid #1B3050" : "none"};">
          <span style="color:#7A96AF;font-size:13px;">Telefone</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${d.interessado_tel ?? "—"}</span>
        </div>
        ${responsavel_nome ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:${d.observacoes ? "1px solid #1B3050" : "none"};">
          <span style="color:#7A96AF;font-size:13px;">Responsável</span>
          <span style="color:#C8D4E3;font-size:13px;font-weight:600;">${responsavel_nome}</span>
        </div>` : ""}
        ${d.observacoes ? `<div style="padding:8px 0;">
          <span style="color:#7A96AF;font-size:13px;">Observações</span>
          <p style="margin:4px 0 0;color:#C8D4E3;font-size:13px;line-height:1.5;">${d.observacoes}</p>
        </div>` : ""}
      </div>
      <p style="font-size:13px;color:#C8D4E3;line-height:1.6;margin-bottom:16px;">
        A carta foi marcada como <strong style="color:#E5B96A;">Em Negociação</strong>. Acesse a plataforma para acompanhar.
      </p>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #1B3050;background:#07101E;">
      <p style="margin:0;font-size:11px;color:#7A96AF;">V3 Partners — Consórcio · Notificação automática</p>
    </div>
  </div>
</body>
</html>`;

        await resend.emails.send({
          from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
          to: adminEmails,
          subject: `Nova Oferta — Carta ${d.carta_code} · ${d.interessado_nome}`,
          html,
        });
      }
    } catch { /* silent — não bloqueia */ }
  }

  return NextResponse.json({ ok: true, oferta });
}
