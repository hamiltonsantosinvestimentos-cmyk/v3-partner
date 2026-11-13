import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { cadastroStarterAntigo, rotuloStarter } from "@/lib/v3-access-rotulos";
import { OFERTA, vencimentoAdesao } from "@/lib/oferta-trial";
import { dataBR } from "@/lib/contrato-parceria-partner";
import { gerarComissaoCloserAssinatura } from "@/lib/closer-commissions";
import { sendText, verificarWhatsapp } from "@/lib/whatsapp/openwa-client";
import { SDR_INTERNO_PARTNER_ID } from "@/lib/sdr-agent";
import {
  ASSUNTO_BOAS_VINDAS, blocoWhiteLabelEmailHtml, mensagemWhatsappEnterprise, phoneParaHistorico, telefoneBrasilParaEnvio,
} from "@/lib/enterprise/comunicado-aprovacao";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://app.v3partners.com.br";

// ─── E-mail de boas-vindas via Resend ─────────────────────────────────────────
// Devolve se a Resend aceitou o envio (res.ok). O Enterprise usa o resultado no aviso ao ADMIN.
// adesaoOferta: Gold/Diamante do link pago (BRIEF 2026-11-13). pago = cora_invoice_status PAID; sem fatura = link grátis.
type AdesaoOferta = { pago: boolean; valor: string; vencimento: string | null; acessoAte: string };

async function enviarBoasVindas(email: string, nome: string, plano: string, cartaoRecorrenteLink?: string | null, starterAntigo = false, adesaoOferta: AdesaoOferta | null = null): Promise<{ ok: boolean; motivo?: string }> {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return { ok: false, motivo: "RESEND_API_KEY ausente" };

  const planoLabel = plano === "ENTERPRISE" ? "V3 Enterprise" : plano === "PARTNER_PRO" ? "V3 Partner PRO" : plano === "PARTNER_HE" ? "Partner HE" : plano === "GOLD" ? "V3 Gold" : plano === "DIAMANTE" ? "V3 Diamante" : plano === "STARTER" ? rotuloStarter(starterAntigo) : "V3 Partner";
  const comissao   = plano === "ENTERPRISE" ? "55%" : plano === "PARTNER_PRO" ? "50%" : plano === "PARTNER_HE" ? "50%" : plano === "GOLD" ? "25%" : plano === "DIAMANTE" ? "40%" : plano === "STARTER" ? "20%" : "35%";

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09081A;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 20px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <p style="font-size:22px;font-weight:800;letter-spacing:4px;color:#C9A84C;margin:0;">V3 PARTNERS</p>
      <p style="font-size:11px;color:#7A8FA8;margin:4px 0 0;letter-spacing:1px;">PLATAFORMA FINANCEIRA</p>
    </div>

    <!-- Card principal -->
    <div style="background:#111F35;border:1px solid #243A66;border-radius:16px;padding:32px;margin-bottom:16px;">
      <p style="font-size:11px;font-weight:700;letter-spacing:2px;color:#C9A84C;text-transform:uppercase;margin:0 0 12px;">Cadastro Aprovado</p>
      <h1 style="font-size:22px;font-weight:700;color:#F0ECE4;margin:0 0 8px;">Bem-vindo, ${nome}!</h1>
      <p style="font-size:14px;color:#7A8FA8;margin:0 0 28px;line-height:1.6;">
        Seu cadastro como <strong style="color:#C9A84C;">${planoLabel}</strong> foi aprovado.
        Você já pode acessar a plataforma e começar a gerar operações com até <strong style="color:#C9A84C;">${comissao}</strong> de comissionamento.
      </p>
      ${(plano === "GOLD" || plano === "DIAMANTE") && adesaoOferta ? `
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:12px;padding:16px;margin:0 0 24px;">
        <p style="font-size:13px;color:#F0ECE4;margin:0;line-height:1.6;">
          ${adesaoOferta.pago
            ? `<strong style="color:#C9A84C;">Sua 1ª mensalidade foi confirmada.</strong> Seu acesso vale até <strong style="color:#C9A84C;">${adesaoOferta.acessoAte}</strong>.`
            : `<strong style="color:#C9A84C;">Sua 1ª mensalidade (${adesaoOferta.valor}) vence em ${adesaoOferta.vencimento ?? "3 dias"}.</strong> O acesso depende do pagamento.`}
          Depois, a mensalidade é de <strong style="color:#C9A84C;">${adesaoOferta.valor}/mês</strong>, sem fidelidade: você pode interromper quando quiser.
        </p>
      </div>` : plano === "GOLD" || plano === "DIAMANTE" ? `
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:12px;padding:16px;margin:0 0 24px;">
        <p style="font-size:13px;color:#F0ECE4;margin:0;line-height:1.6;">
          <strong style="color:#C9A84C;">Seus ${OFERTA.trialDias} dias grátis começam hoje.</strong> Depois, a mensalidade é de
          <strong style="color:#C9A84C;">${plano === "GOLD" ? "R$ 397" : "R$ 897"}/mês</strong>, sem fidelidade: você pode interromper quando quiser.
        </p>
      </div>` : ""}
      ${plano === "ENTERPRISE" ? blocoWhiteLabelEmailHtml() : ""}

      <!-- Credenciais -->
      <div style="background:#0A1628;border:1px solid #243A66;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:#7A8FA8;text-transform:uppercase;margin:0 0 16px;">Seus dados de acesso</p>
        <div style="margin-bottom:12px;">
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">E-mail</p>
          <p style="font-size:15px;color:#F0ECE4;font-weight:600;margin:0;">${email}</p>
        </div>
        <div>
          <p style="font-size:11px;color:#7A8FA8;margin:0 0 4px;">Senha temporária</p>
          <p style="font-size:20px;color:#C9A84C;font-weight:700;font-family:monospace;letter-spacing:4px;margin:0;">12345678</p>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:20px;">
        <a href="${SITE_URL}/login"
           style="display:inline-block;background:#C9A84C;color:#09081A;font-size:14px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:0.5px;">
          Acessar Plataforma →
        </a>
      </div>

      ${cartaoRecorrenteLink ? `
      <!-- Assinatura recorrente no cartão -->
      <div style="background:#0A1628;border:1px solid #C9A84C55;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p style="font-size:13px;color:#C9A84C;margin:0 0 8px;font-weight:700;">Finalize sua assinatura recorrente</p>
        <p style="font-size:13px;color:#7A8FA8;margin:0 0 16px;line-height:1.6;">
          Você escolheu pagar a mensalidade com cartão recorrente (fidelidade de 12 meses). Clique no botão abaixo para cadastrar seu cartão e ativar a cobrança automática mensal.
        </p>
        <div style="text-align:center;">
          <a href="${cartaoRecorrenteLink}"
             style="display:inline-block;background:#C9A84C;color:#09081A;font-size:13px;font-weight:700;padding:12px 28px;border-radius:8px;text-decoration:none;">
            Ativar assinatura recorrente →
          </a>
        </div>
      </div>` : ""}

      <!-- Alerta senha -->
      <div style="background:#C9A84C10;border:1px solid #C9A84C35;border-radius:8px;padding:14px;">
        <p style="font-size:13px;color:#C9A84C;margin:0;line-height:1.5;">
          <strong>Importante:</strong> No primeiro acesso você será solicitado a definir sua senha pessoal. A senha temporária acima é apenas para o primeiro login.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <p style="font-size:11px;color:#3A5070;text-align:center;margin:0;">
      © 2026 V3 Partners · <a href="${SITE_URL}" style="color:#C9A84C;text-decoration:none;">v3partners.com.br</a>
    </p>
  </div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "V3 Partners <onboarding@resend.dev>",
        to: [email],
        subject: ASSUNTO_BOAS_VINDAS,
        html,
      }),
    });
    return res.ok ? { ok: true } : { ok: false, motivo: `Resend respondeu ${res.status}` };
  } catch {
    // não bloqueia a aprovação
    return { ok: false, motivo: "falha de rede na Resend" };
  }
}

type ResultadoCanal = { ok: boolean; motivo?: string; telefone?: string };

// WhatsApp do comunicado do Enterprise (BRIEF 10/11/2026). Nunca lança: a aprovação já aconteceu.
// Grava o phone como o webhook do SDR vai montar (chatIdToPhone do JID canônico) e marca humano_ativo,
// para a IA do SDR não responder ao cliente Enterprise.
async function enviarWhatsappEnterprise(svc: ReturnType<typeof serviceClient>, telefone: string | null, dados: { nome: string; empresa: string; email: string }): Promise<ResultadoCanal> {
  const t = telefoneBrasilParaEnvio(telefone);
  if (!t.ok) return { ok: false, motivo: t.motivo };
  try {
    const check = await verificarWhatsapp(t.digitos);
    if (check && !check.existe) return { ok: false, motivo: "número sem WhatsApp", telefone: t.exibicao };
    const msg = mensagemWhatsappEnterprise(dados);
    // Com "+", o openwa-client usa os dígitos como estão (sem renormalizar): JID canônico ou 55+DDD+número.
    const destino = `+${phoneParaHistorico(check, t.digitos)}`;
    const enviado = await Promise.race([
      sendText(destino, msg),
      new Promise<boolean>((r) => setTimeout(() => r(false), 15_000)),
    ]).catch(() => false);
    if (!enviado) return { ok: false, motivo: "o WhatsApp da V3 não aceitou o envio (sessão fora do ar?)", telefone: t.exibicao };
    const phone = phoneParaHistorico(check, t.digitos);
    const agora = new Date().toISOString();
    const { error: e1 } = await svc.from("sdr_conversas").insert({
      phone, canal: "whatsapp", role: "assistant", content: `[Comunicado Enterprise] ${msg}`, instance: "openwa", partner_id: null,
    });
    if (e1) console.error("[aprovar] falha ao gravar sdr_conversas", { code: e1.code });
    const { error: e2 } = await svc.from("sdr_leads").upsert({
      phone, partner_id: SDR_INTERNO_PARTNER_ID, canal: "whatsapp", humano_ativo: true,
      last_message_at: agora, last_message_preview: "[Comunicado Enterprise]", updated_at: agora,
    }, { onConflict: "phone,partner_id", ignoreDuplicates: false });
    if (e2) console.error("[aprovar] falha ao marcar humano_ativo", { code: e2.code });
    if (!check) return { ok: true, telefone: t.exibicao, motivo: "WhatsApp enviado, mas a trava do bot pode não valer para este número: marque Atendimento humano no inbox do SDR" };
    if (e2) return { ok: true, telefone: t.exibicao, motivo: "WhatsApp enviado, mas não foi possível marcar Atendimento humano: marque no inbox do SDR" };
    return { ok: true, telefone: t.exibicao };
  } catch {
    return { ok: false, motivo: "erro inesperado no envio do WhatsApp", telefone: t.exibicao };
  }
}

export async function POST(req: NextRequest) {
  // Verifica que é ADMIN
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const { id, acao, observacao, cartao_recorrente_link } = await req.json() as {
    id: string; acao: "APROVAR" | "REPROVAR" | "EM_ANALISE"; observacao?: string; cartao_recorrente_link?: string;
  };

  if (!id || !acao) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const svc = serviceClient();

  // Busca o cadastro
  const { data: reg } = await svc
    .from("partner_registrations")
    .select("*, referred_by_partner_id")
    .eq("id", id)
    .single();

  if (!reg) return NextResponse.json({ error: "Cadastro não encontrado" }, { status: 404 });

  // Cartão recorrente: exige o link da assinatura InfinitePay (criada manualmente
  // no painel deles) antes de aprovar, já que é enviado no e-mail de boas-vindas.
  const linkCartaoFinal = cartao_recorrente_link ?? reg.cartao_recorrente_link ?? null;
  if (acao === "APROVAR" && reg.plano_recorrencia === "ANUAL_CARTAO" && !linkCartaoFinal) {
    return NextResponse.json({ error: "Informe o link de assinatura recorrente da InfinitePay antes de aprovar." }, { status: 400 });
  }

  const novoStatus = acao === "APROVAR" ? "APROVADO" : acao === "REPROVAR" ? "REPROVADO" : "EM_ANALISE";

  // Se REPROVAR ou EM_ANALISE, só atualiza o status
  if (acao !== "APROVAR") {
    await svc.from("partner_registrations").update({
      status: novoStatus,
      observacao: observacao ?? null,
      revisado_por: user.id,
      revisado_em: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", id);

    return NextResponse.json({ ok: true, status: novoStatus });
  }

  // ─── APROVAR: criar usuário no Supabase Auth + profile ───────────────────
  const planoRole = reg.plano === "ENTERPRISE" ? "ENTERPRISE" : reg.plano === "PARTNER_PRO" ? "PARTNER_PRO" : reg.plano === "PARTNER_HE" ? "PARTNER_HE" : reg.plano === "GOLD" ? "GOLD" : reg.plano === "DIAMANTE" ? "DIAMANTE" : reg.plano === "STARTER" ? "STARTER" : "PARTNER";
  const email     = reg.email;
  const nome      = reg.nome_completo ?? reg.razao_social ?? "Parceiro";

  // Verifica se já existe. profiles primeiro: listUsers() só devolve a primeira página (BRIEF 10/11/2026, risco c).
  const { data: perfilExistente } = await svc.from("profiles").select("id").ilike("email", String(email ?? "").replace(/[\\%_]/g, "\\$&")).limit(1).maybeSingle();
  let jaExiste = !!perfilExistente;
  if (!jaExiste) {
    const { data: existing } = await svc.auth.admin.listUsers();
    jaExiste = !!existing?.users?.some((u) => u.email === email);
  }
  let comunicado: { email: ResultadoCanal; whatsapp: ResultadoCanal } | undefined;

  // Link pago da oferta (BRIEF 2026-11-13): Gold/Diamante com fatura de adesão. O texto só diz "paga"
  // com cora_invoice_status PAID. Vencimento = created_at + 3 dias pelo mesmo helper da cobrança,
  // formatado por texto (dataBR); "vale até" = aprovação + 30 dias, em Brasília.
  const ofertaComFatura = (planoRole === "GOLD" || planoRole === "DIAMANTE") && !!reg.cora_invoice_id;
  const pagouAdesao = ofertaComFatura && reg.cora_invoice_status === "PAID";
  const adesaoOferta: AdesaoOferta | null = ofertaComFatura ? {
    pago: pagouAdesao,
    valor: (Number(reg.cora_amount_cents ?? 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    vencimento: reg.created_at ? dataBR(vencimentoAdesao(new Date(reg.created_at))) : null,
    acessoAte: new Date(Date.now() + OFERTA.trialDias * 86400000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
  } : null;

  if (!jaExiste) {
    // Cria o usuário com senha padrão + flag para trocar no primeiro acesso
    const { data: newUser, error: createErr } = await svc.auth.admin.createUser({
      email,
      password: "12345678",
      email_confirm: true,
      user_metadata: { full_name: nome },
      app_metadata: { must_change_password: true },
    });

    if (createErr) {
      return NextResponse.json({ error: `Erro ao criar usuário: ${createErr.message}` }, { status: 500 });
    }

    // Cria o profile na tabela
    if (newUser?.user) {
      // Quem entrou num dos dois planos anuais (Pix/Boleto à vista OU cartão em
      // 12x, ambos com fidelidade de 12 meses) já está coberto por 12 meses --
      // trial_expires_at é a mesma data que efetivoVencimento()
      // (lib/partner-vencimento.ts) usa pra decidir quando o cron de cobrança
      // mensal (assinaturas-vencendo) deve gerar a próxima fatura via Cora.
      // Sem isso, o cron cairia no default de created_at + 30 dias e tentaria
      // gerar uma cobrança Cora extra um mês depois -- duplicando quem pagou
      // à vista, ou brigando com a cobrança recorrente que o InfinitePay já
      // está fazendo por fora pra quem escolheu cartão.
      const compromissoDe12Meses = reg.plano_recorrencia === "ANUAL_PIX_BOLETO" || reg.plano_recorrencia === "ANUAL_CARTAO";
      // Gold/Diamante (oferta única): 30 dias grátis a partir da aprovação. No vencimento o cron gera
      // a mensalidade (D-5) e, se não for paga, o SubscriptionGuard trava o acesso: sem fidelidade.
      const trialOferta = planoRole === "GOLD" || planoRole === "DIAMANTE";
      await svc.from("profiles").upsert({
        id:         newUser.user.id,
        full_name:  nome,
        role:       planoRole,
        email,
        kyc_status: "APROVADO",
        updated_at: new Date().toISOString(),
        ...(compromissoDe12Meses ? { trial_expires_at: new Date(Date.now() + 365 * 86400000).toISOString() } : {}),
        ...(trialOferta ? { trial_expires_at: new Date(Date.now() + OFERTA.trialDias * 86400000).toISOString() } : {}),
        ...(reg.referred_by_partner_id ? { referred_by_partner_id: reg.referred_by_partner_id } : {}),
      }, { onConflict: "id" });

      // Adesão paga antes da aprovação: comissão do closer sobre a 1ª mensalidade, se já houver
      // closer_id (na prática o vínculo em Usuários é quem dispara). pagamentoId = reg.id evita duplicar.
      if (pagouAdesao) {
        await gerarComissaoCloserAssinatura(svc, {
          partnerId: newUser.user.id, valorPago: Number(reg.cora_amount_cents ?? 0) / 100, pagamentoId: reg.id, dataPagamento: reg.cora_paid_at ?? new Date().toISOString(),
        });
      }
    }

    if (planoRole === "ENTERPRISE") {
      // Enterprise (BRIEF 10/11/2026): e-mail com o bloco do white label + WhatsApp, e o resultado volta ao ADMIN.
      const resEmail = await enviarBoasVindas(email, nome, reg.plano, linkCartaoFinal, false).catch(() => ({ ok: false, motivo: "falha no envio" }));
      const resWhats = await enviarWhatsappEnterprise(svc, reg.telefone ?? null, { nome, empresa: reg.razao_social ?? nome, email });
      comunicado = { email: resEmail, whatsapp: resWhats };
    } else {
      // Envia e-mail de boas-vindas (async, não bloqueia)
      enviarBoasVindas(email, nome, reg.plano, linkCartaoFinal, cadastroStarterAntigo(reg.plano, reg.created_at), adesaoOferta).catch(() => {});
    }
  }

  // Atualiza o cadastro
  await svc.from("partner_registrations").update({
    status:       "APROVADO",
    observacao:   observacao ?? null,
    revisado_por: user.id,
    revisado_em:  new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    ...(cartao_recorrente_link ? { cartao_recorrente_link } : {}),
  }).eq("id", id);

  return NextResponse.json({ ok: true, status: "APROVADO", email, role: planoRole, ...(comunicado ? { comunicado } : {}) });
}
