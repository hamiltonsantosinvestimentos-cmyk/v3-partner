import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { atualizarMetadata } from "@/lib/credit-proposal-meta";
import { emailValido, montarEmailPreAprovacao, validarPreAprovacao, type PreAprovacaoRegistro } from "@/lib/pre-aprovacao";

// POST /api/credit-proposals/[id]/pre-aprovacao
// Grava a pré-aprovação em metadata.pre_aprovacao (o anterior vai para pre_aprovacao_historico) e envia
// o e-mail ao cliente e ao partner. Só a equipe da Mesa. BRIEF 2026-11-03_pre-aprovacao-mesa-operacional.md.

const EQUIPE = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
type Meta = Record<string, unknown>;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!EQUIPE.includes(profile?.role ?? "")) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const v = validarPreAprovacao(body);
  if (!v.ok) return NextResponse.json({ error: v.erros.join(" ") }, { status: 422 });

  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: prop, error: propErr } = await db.from("credit_desk_proposals").select("*").eq("id", id).single();
  if (propErr || !prop) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const meta = (prop.metadata ?? {}) as Meta;
  const candidatoCliente = (typeof meta.email === "string" && meta.email.trim() ? meta.email : prop.email) as unknown;
  if (!emailValido(candidatoCliente)) {
    return NextResponse.json({ error: "Cadastre um e-mail válido do cliente na proposta para enviar a pré-aprovação." }, { status: 422 });
  }
  const emailCliente = candidatoCliente.trim();

  let emailPartner: string | null = null;
  let nomePartner: string | null = null;
  if (prop.partner_id) {
    const { data: au } = await db.auth.admin.getUserById(prop.partner_id);
    if (emailValido(au?.user?.email)) emailPartner = au!.user!.email!.trim();
    const { data: pp } = await db.from("profiles").select("full_name").eq("id", prop.partner_id).maybeSingle();
    nomePartner = (pp?.full_name as string | undefined) ?? null;
  }

  if (!process.env.RESEND_API_KEY) return NextResponse.json({ error: "Envio de e-mail não configurado." }, { status: 500 });
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const enviadoEm = new Date().toISOString();
  const codigo = String(prop.code ?? prop.id);
  const clienteNome = (prop.client_name as string | null) ?? null;

  const enviar = async (destinatario: "cliente" | "partner", to: string, nome: string | null) => {
    const { subject, html } = montarEmailPreAprovacao({ destinatario, nome, codigo, clienteNome, dados: v.dados, enviadoEm });
    const r = await resend.emails.send({ from: "V3 Partners <noreply@v3partners.com.br>", to, subject, html });
    if (r.error) throw new Error(r.error.message);
  };

  // O cliente é o destinatário que vale para a Cláusula 4-A: sem ele, nada é gravado como enviado.
  try {
    await enviar("cliente", emailCliente, clienteNome);
  } catch (e) {
    console.error("[pre-aprovacao] falha no e-mail do cliente:", e);
    return NextResponse.json({ error: "O e-mail ao cliente não saiu. Nada foi registrado; tente novamente." }, { status: 502 });
  }
  let partnerEnviado: string | null = null;
  let avisoPartner: string | null = null;
  if (emailPartner) {
    try { await enviar("partner", emailPartner, nomePartner); partnerEnviado = emailPartner; }
    catch (e) { console.error("[pre-aprovacao] falha no e-mail do partner:", e); avisoPartner = "O e-mail ao cliente saiu, mas o do partner falhou."; }
  } else if (prop.partner_id) {
    avisoPartner = "O partner não tem e-mail válido cadastrado; só o cliente recebeu.";
  } else {
    avisoPartner = "A proposta não tem partner; só o cliente recebeu.";
  }

  const registro: PreAprovacaoRegistro = {
    ...v.dados,
    enviado_em: enviadoEm,
    enviado_por: user.id,
    enviado_por_nome: (profile?.full_name as string | undefined) ?? null,
    emails: { cliente: emailCliente, partner: partnerEnviado },
  };
  const r = await atualizarMetadata(db, id, (m) => {
    const anterior = m.pre_aprovacao as PreAprovacaoRegistro | undefined;
    const historico = Array.isArray(m.pre_aprovacao_historico) ? (m.pre_aprovacao_historico as PreAprovacaoRegistro[]) : [];
    return { ...m, pre_aprovacao: registro, pre_aprovacao_historico: anterior ? [anterior, ...historico] : historico };
  });
  if (!r.ok) {
    console.error("[pre-aprovacao] e-mail enviado mas gravação falhou:", r.error);
    return NextResponse.json({ error: "O e-mail saiu, mas o registro não foi gravado. Avise o suporte antes de reenviar." }, { status: 500 });
  }

  await db.from("audit_logs").insert({
    user_id: user.id,
    user_name: profile?.full_name ?? null,
    action: "pre_aprovacao_enviada",
    entity: "credit_desk_proposals",
    entity_id: id,
    new_data: { enviado_em: enviadoEm, cliente: true, partner: !!partnerEnviado, reenvio: !!meta.pre_aprovacao },
  });

  return NextResponse.json({ ok: true, pre_aprovacao: registro, metadata: r.metadata, aviso: avisoPartner });
}
