import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { pedidoPeloId } from "@/lib/analise-estruturada/documentos";
import { BUCKET_ANALISE } from "@/lib/analise-estruturada/checklist";
import { gerarParecer, carregarEstadoParecer, marcarEntregue, caminhoPdfParecer, protocoloDoPedido } from "@/lib/analise-estruturada/parecer";
import { VEREDITO_LABEL, type Veredito } from "@/lib/analise-estruturada/parecer-html";
import { TERMO_VALIDADO_JURIDICO } from "@/lib/analise-estruturada/termo";
import { gerarComissaoConsultaEntregue } from "@/lib/consulta-commissions";
import { createNotification } from "@/lib/notify";

// Parecer da Análise Estruturada V3 pela Mesa (entrega 4).
//   GET                                          → estado + link do PDF (1h)
//   POST { acao: "gerar", veredito?, comentario? } → PDF de rascunho
//   POST { acao: "assinar", veredito, comentario? } → PDF final assinado pelo analista logado
//   POST { acao: "entregar" }                     → e-mail ao cliente, aviso ao partner, pedido entregue e comissão
// A entrega fica bloqueada enquanto o termo de responsabilidade não for validado pelo jurídico.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const VALIDADE_LINK_CLIENTE = 30 * 24 * 3600;

interface RouteParams { params: Promise<{ orderId: string }> }

async function autorizado(): Promise<{ id: string; nome: string } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ROLES.includes(profile?.role ?? "")) return null;
  return { id: user.id, nome: profile?.full_name ?? user.email ?? "Analista" };
}

const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const vereditoValido = (v: unknown): v is Veredito => typeof v === "string" && v in VEREDITO_LABEL;

async function linkPdf(db: ReturnType<typeof svc>, orderId: string, segundos: number): Promise<string | null> {
  const { data } = await db.storage.from(BUCKET_ANALISE).createSignedUrl(caminhoPdfParecer(orderId), segundos, {
    download: `Parecer-Analise-Estruturada-${protocoloDoPedido(orderId)}.pdf`,
  });
  return data?.signedUrl ?? null;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  if (!(await autorizado())) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { orderId } = await params;
  const db = svc();
  if (!(await pedidoPeloId(db, orderId))) return NextResponse.json({ estado: null });
  const estado = await carregarEstadoParecer(db, orderId);
  return NextResponse.json({ estado, pdf: estado ? await linkPdf(db, orderId, 3600) : null, termoValidado: TERMO_VALIDADO_JURIDICO });
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const usuario = await autorizado();
  if (!usuario) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  const { orderId } = await params;
  const db = svc();
  const pedido = await pedidoPeloId(db, orderId);
  if (!pedido) return NextResponse.json({ error: "Pedido não é da Análise Estruturada." }, { status: 404 });

  const body = await req.json().catch(() => ({})) as { acao?: string; veredito?: string; comentario?: string | null };

  try {
    if (body.acao === "gerar" || body.acao === "assinar") {
      if (body.veredito !== undefined && !vereditoValido(body.veredito)) return NextResponse.json({ error: "Veredito inválido." }, { status: 400 });
      if (body.acao === "assinar" && !vereditoValido(body.veredito)) return NextResponse.json({ error: "Escolha o veredito antes de assinar." }, { status: 400 });
      const estado = await gerarParecer(db, pedido, {
        veredito: body.veredito as Veredito | undefined,
        comentario: body.comentario,
        assinatura: body.acao === "assinar" ? { analista: usuario.nome } : null,
      });
      return NextResponse.json({ estado, pdf: await linkPdf(db, orderId, 3600), termoValidado: TERMO_VALIDADO_JURIDICO });
    }

    if (body.acao === "entregar") {
      if (!TERMO_VALIDADO_JURIDICO) {
        return NextResponse.json({ error: "Entrega bloqueada: o termo de responsabilidade ainda não foi validado pelo jurídico." }, { status: 409 });
      }
      const estado = await carregarEstadoParecer(db, orderId);
      if (!estado || estado.status === "rascunho") return NextResponse.json({ error: "Assine o parecer antes de entregar." }, { status: 409 });
      if (estado.status === "entregue") return NextResponse.json({ error: "Parecer já entregue." }, { status: 409 });

      const { data: pedidoCompleto } = await db.from("partner_service_orders").select("client_email").eq("id", orderId).single();
      const email = (pedidoCompleto as { client_email?: string } | null)?.client_email;
      if (!email) return NextResponse.json({ error: "Pedido sem e-mail do cliente." }, { status: 422 });
      const link = await linkPdf(db, orderId, VALIDADE_LINK_CLIENTE);
      if (!link) return NextResponse.json({ error: "Falha ao gerar o link do parecer." }, { status: 500 });

      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "V3 Partners <inteligencia@v3partners.com.br>",
          to: [email],
          subject: "Seu parecer da Análise Estruturada V3 está pronto",
          html: `
            <div style="background:#09081A;color:#F5F1E8;font-family:sans-serif;padding:40px;border-radius:8px;max-width:560px;margin:0 auto">
              <div style="color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:20px">V3 PARTNERS</div>
              <h2 style="font-size:20px;margin-bottom:12px">Seu parecer está pronto</h2>
              <p style="color:#9BAFC5;font-size:13px;line-height:1.7;margin-bottom:24px">
                Olá, <strong style="color:#F5F1E8">${(pedido.client_name ?? "").replace(/</g, "&lt;")}</strong>.<br>
                O parecer técnico da sua Análise Estruturada V3 foi revisado e assinado pela nossa Mesa de Crédito.
                Ele traz a sua capacidade de pagamento, os pontos de atenção, o raio-X dos seus custos bancários e o plano para você acessar crédito.
              </p>
              <a href="${link}" style="display:inline-block;background:#C9A84C;color:#09081A;font-weight:700;font-size:13px;padding:12px 28px;border-radius:6px;text-decoration:none">Baixar meu parecer</a>
              <p style="color:#9BAFC5;font-size:11px;margin-top:24px;line-height:1.6">
                O link fica disponível por 30 dias. Protocolo ${protocoloDoPedido(orderId)}.<br>
                Seu consultor V3 vai conversar com você sobre os próximos passos.
              </p>
            </div>`,
        }),
      });
      if (!r.ok) return NextResponse.json({ error: `Falha ao enviar o e-mail (${r.status}).` }, { status: 502 });

      await db.from("partner_service_orders").update({ report_delivered_at: new Date().toISOString() }).eq("id", orderId);
      const entregue = await marcarEntregue(db, orderId, estado, usuario.nome);

      let comissao: Awaited<ReturnType<typeof gerarComissaoConsultaEntregue>> | null = null;
      try { comissao = await gerarComissaoConsultaEntregue(orderId, usuario.id); } catch (e) { console.error("[parecer] comissão:", e); }

      const partnerId = pedido.partner_id ?? pedido.ref_partner_id;
      if (partnerId) {
        await createNotification({
          user_id: partnerId,
          title: "Parecer entregue ao seu cliente",
          message: `O parecer da Análise Estruturada de ${pedido.client_name ?? "seu cliente"} foi entregue. Hora de conversar sobre a operação.`,
          type: "proposal",
          action_url: "/mesa-credito/nivel-1",
        }).catch(() => {});
      }
      return NextResponse.json({ estado: entregue, pdf: await linkPdf(db, orderId, 3600), comissao, termoValidado: TERMO_VALIDADO_JURIDICO });
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Falha ao processar o parecer." }, { status: 422 });
  }
}
