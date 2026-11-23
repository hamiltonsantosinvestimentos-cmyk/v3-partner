import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { Resend } from "resend";
import { z } from "zod";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import { escapeHtml } from "@/lib/html-escape";
import { ehInterno } from "../vitrine";

export const dynamic = "force-dynamic";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

// GET /api/consorcio/ofertas?carta_id=...&status=pendente
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  // Ofertas têm nome, CPF/CNPJ e telefone do interessado: só a equipe interna lê (BRIEF 2026-11-21 Consórcio, item 2).
  const { data: perfil } = await svc().from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!ehInterno(perfil?.role)) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const cartaId = searchParams.get("carta_id");
  const status = searchParams.get("status");

  let query = svc().from("consorcio_ofertas").select("*").order("created_at", { ascending: false });
  if (cartaId) query = query.eq("carta_id", cartaId);
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("[consorcio/ofertas GET]", error.message);
    return NextResponse.json({ error: "Não foi possível carregar as ofertas." }, { status: 500 });
  }
  return NextResponse.json({ ofertas: data ?? [] });
}

const ofertaSchema = z.object({
  carta_id: z.string().uuid(),
  // Ignorados: código e crédito vêm da carta lida do banco. Mantidos opcionais para a tela atual continuar enviando.
  carta_code: z.string().optional(),
  carta_credit_value: z.number().optional(),
  interessado_nome: z.string().min(1).max(200),
  interessado_tel: z.string().max(30).optional().nullable(),
  interessado_cpf_cnpj: z.string().max(20).optional().nullable(),
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

  // A carta precisa existir, não estar excluída e estar à venda (BRIEF 2026-11-21 Consórcio, item 4).
  const { data: carta } = await svc()
    .from("consorcio_cartas")
    .select("id, code, credit_value, status, deleted_at")
    .eq("id", d.carta_id)
    .maybeSingle();
  if (!carta || carta.deleted_at || !["DISPONIVEL", "NEGOCIACAO"].includes(carta.status as string)) {
    return NextResponse.json({ error: "Esta carta não está disponível para oferta." }, { status: 409 });
  }
  const cartaCode = String(carta.code);
  const cartaCredito = Number(carta.credit_value);

  // Responsável só pode ser da equipe interna; qualquer outro é ignorado.
  let responsavel_id: string | null = null;
  let responsavel_nome: string | null = null;
  if (d.responsavel_id) {
    const { data: resp } = await svc()
      .from("profiles")
      .select("full_name, role")
      .eq("id", d.responsavel_id)
      .maybeSingle();
    if (resp && ehInterno(resp.role as string)) {
      responsavel_id = d.responsavel_id;
      responsavel_nome = resp.full_name ?? null;
    }
  }

  // 1. Inserir oferta em consorcio_ofertas (service_role bypassa RLS)
  const { data: oferta, error: ofertaError } = await svc()
    .from("consorcio_ofertas")
    .insert({
      carta_id: d.carta_id,
      carta_code: cartaCode,
      carta_credit_value: cartaCredito,
      interessado_nome: d.interessado_nome,
      interessado_tel: d.interessado_tel ?? null,
      interessado_cpf_cnpj: d.interessado_cpf_cnpj ?? null,
      valor_oferta: d.valor_oferta,
      observacoes: d.observacoes ?? null,
      responsavel_id,
      responsavel_nome,
      created_by: user.id,
    })
    .select()
    .single();

  if (ofertaError) {
    console.error("[consorcio/ofertas POST]", ofertaError.message);
    return NextResponse.json({ error: "Não foi possível registrar a oferta." }, { status: 500 });
  }

  // 2. Atualizar status da carta para NEGOCIACAO
  await svc()
    .from("consorcio_cartas")
    .update({ status: "NEGOCIACAO" })
    .eq("id", d.carta_id)
    .in("status", ["DISPONIVEL", "NEGOCIACAO"]);

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
        message: `${d.interessado_nome} fez uma oferta de ${fmtCurrency(d.valor_oferta)} para a carta ${cartaCode} (crédito ${fmtCurrency(cartaCredito)}).`,
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
<body style="margin:0;padding:0;background:#09081A;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:40px auto;background:#162744;border-radius:12px;overflow:hidden;border:1px solid #243A66;">
    <div style="padding:24px 32px;border-bottom:1px solid #243A66;background:#09081A;">
      <span style="font-size:16px;font-weight:800;color:#E8C97A;letter-spacing:0.08em;">V3 PARTNERS</span>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#F5F1E8;">
        Nova Oferta — Carta ${escapeHtml(cartaCode)}
      </h2>
      <div style="background:#09081A;border-radius:8px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #243A66;">
          <span style="color:#9BAFC5;font-size:13px;">Carta</span>
          <span style="color:#F5F1E8;font-size:13px;font-weight:600;">${escapeHtml(cartaCode)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #243A66;">
          <span style="color:#9BAFC5;font-size:13px;">Valor do Crédito</span>
          <span style="color:#F5F1E8;font-size:13px;font-weight:600;">${fmtCurrency(cartaCredito)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #243A66;">
          <span style="color:#9BAFC5;font-size:13px;">Valor da Oferta</span>
          <span style="color:#E8C97A;font-size:13px;font-weight:700;">${fmtCurrency(d.valor_oferta)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #243A66;">
          <span style="color:#9BAFC5;font-size:13px;">Interessado</span>
          <span style="color:#F5F1E8;font-size:13px;font-weight:600;">${escapeHtml(d.interessado_nome)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:${d.observacoes ? "1px solid #243A66" : "none"};">
          <span style="color:#9BAFC5;font-size:13px;">Telefone</span>
          <span style="color:#F5F1E8;font-size:13px;font-weight:600;">${escapeHtml(d.interessado_tel ?? "—")}</span>
        </div>
        ${responsavel_nome ? `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:${d.observacoes ? "1px solid #243A66" : "none"};">
          <span style="color:#9BAFC5;font-size:13px;">Responsável</span>
          <span style="color:#F5F1E8;font-size:13px;font-weight:600;">${escapeHtml(responsavel_nome)}</span>
        </div>` : ""}
        ${d.observacoes ? `<div style="padding:8px 0;">
          <span style="color:#9BAFC5;font-size:13px;">Observações</span>
          <p style="margin:4px 0 0;color:#F5F1E8;font-size:13px;line-height:1.5;">${escapeHtml(d.observacoes)}</p>
        </div>` : ""}
      </div>
      <p style="font-size:13px;color:#F5F1E8;line-height:1.6;margin-bottom:16px;">
        A carta foi marcada como <strong style="color:#E8C97A;">Em Negociação</strong>. Acesse a plataforma para acompanhar.
      </p>
    </div>
    <div style="padding:18px 32px;border-top:1px solid #243A66;background:#09081A;">
      <p style="margin:0;font-size:11px;color:#9BAFC5;">V3 Partners — Consórcio · Notificação automática</p>
    </div>
  </div>
</body>
</html>`;

        const ofertaSubjectGate = auditText(`Nova Oferta: Carta ${cartaCode} · ${d.interessado_nome}`);
        const ofertaHtmlGate = auditHtml(html);
        if (ofertaHtmlGate.blocking.length > 0) console.error("[consorcio/ofertas] Brand Guardian bloqueou:", ofertaHtmlGate.blocking);
        await resend.emails.send({
          from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
          to: adminEmails,
          subject: ofertaSubjectGate.corrected,
          html: ofertaHtmlGate.corrected,
        });
      }
    } catch { /* silent — não bloqueia */ }
  }

  return NextResponse.json({ ok: true, oferta });
}
