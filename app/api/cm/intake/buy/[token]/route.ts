import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import { notifyByRoles } from "@/lib/notify";
import { getCmFlag, FLAG_MEETING_AUTOTRIGGER } from "@/lib/cm-flags";
import { notifyMeetingLink } from "@/lib/cm-meeting";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id, nome_contato, email, intake_locked, intake_data, nda_accepted")
    .eq("intake_token", token)
    .single();

  if (!demand)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (demand.intake_locked)
    return NextResponse.json({
      error: "Este formulário já foi preenchido anteriormente através deste link. Para nova submissão, solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  return NextResponse.json({
    demand_id: demand.id,
    prefill: {
      nome_contato: demand.nome_contato !== "Pendente" ? demand.nome_contato : "",
      email: demand.email !== "pendente@pendente.com" ? demand.email : "",
      ...(demand.intake_data as Record<string, unknown> ?? {}),
    },
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: demand } = await svc()
    .from("investor_demands")
    .select("id, status, intake_locked, origin_partner_id, created_by, apelido")
    .eq("intake_token", token)
    .single();

  if (!demand)
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 404 });

  if (demand.intake_locked)
    return NextResponse.json({
      error: "Este formulário já foi preenchido anteriormente através deste link. Para nova submissão, solicite um novo link à equipe V3 Partners.",
      locked: true,
    }, { status: 409 });

  const body = await req.json();
  const {
    nome_contato, email, telefone, empresa, cnpj, cpf,
    nacionalidade, profissao, estado_civil, identidade_orgao, endereco,
    setores, jurisdicao_alvo, natureza_preferida, asset_types_preferidos,
    ticket_min, ticket_max, desagio_min, criterios, nda_accepted,
    purchase_frequency_type, recurrence_months, origin_partner_id,
    // Item 3 do brief de 21/09/2026: sem coluna propria, dentro de
    // intake_data (jsonb), mesmo padrao ja usado neste UPDATE.
    tipo_pessoa, comissao_aceita_pct,
  } = body;

  if (!nome_contato || !email)
    return NextResponse.json({ error: "Nome e email são obrigatórios" }, { status: 422 });

  // Origin partner e sempre resolvido no servidor contra profiles.id real -- um valor
  // invalido/malformado em ?partner= nunca bloqueia o cadastro do comprador, so fica sem
  // atribuicao (mesmo principio ja usado para documento opcional: nada trava o registro).
  // Preserva o que a Mesa ja tiver atribuido no momento de gerar o link (18/08/2026): o
  // formulario publico nunca manda origin_partner_id, entao sem este fallback o submit
  // apagava silenciosamente a atribuicao feita na criacao do link.
  let resolvedOriginPartnerId: string | null = demand.origin_partner_id ?? null;
  if (origin_partner_id && typeof origin_partner_id === "string") {
    const { data: partnerProfile } = await svc()
      .from("profiles")
      .select("id")
      .eq("id", origin_partner_id)
      .maybeSingle();
    if (partnerProfile) resolvedOriginPartnerId = partnerProfile.id;
  }

  const freqType = ["SINGLE_PURCHASE", "RECURRENT_MONTHLY"].includes(purchase_frequency_type)
    ? purchase_frequency_type
    : null;
  const recMonths = freqType === "RECURRENT_MONTHLY" && recurrence_months
    ? Math.min(60, Math.max(1, Number(recurrence_months)))
    : null;

  const { error } = await svc()
    .from("investor_demands")
    .update({
      nome_contato,
      email,
      telefone: telefone ?? null,
      empresa: empresa ?? null,
      cnpj: cnpj ?? null,
      cpf: cpf ?? null,
      nacionalidade: nacionalidade ?? null,
      profissao: profissao ?? null,
      estado_civil: estado_civil ?? null,
      identidade_orgao: identidade_orgao ?? null,
      endereco: endereco ?? null,
      setores: setores?.length ? setores : ["precatorio"],
      ufs: jurisdicao_alvo?.length ? jurisdicao_alvo : ["RJ"],
      jurisdicao_alvo: jurisdicao_alvo ?? null,
      natureza_preferida: natureza_preferida ?? null,
      asset_types_preferidos: asset_types_preferidos ?? null,
      ticket_min: ticket_min ? Number(ticket_min) : 0,
      ticket_max: ticket_max ? Number(ticket_max) : 99999999,
      desagio_min: desagio_min ? Number(desagio_min) : null,
      tipos_operacao: ["compra"],
      criterios: criterios ?? null,
      origem: "intake_buy",
      // Fase 5, 5.3 (19/09/2026): o status NAO e mais gravado aqui. Ate 19/09 este update
      // fazia status = "ativo", o que jogava o comprador direto no motor de match sem
      // nenhuma validacao da Mesa. Agora o status anda pela maquina de estados
      // (transition_cm_demand_status) logo abaixo, e so vira "ativo" depois da aprovacao.
      alerta_ativo: true,
      nda_accepted: nda_accepted ?? false,
      nda_accepted_at: nda_accepted ? new Date().toISOString() : null,
      purchase_frequency_type: freqType,
      recurrence_months: recMonths,
      origin_partner_id: resolvedOriginPartnerId,
      intake_locked: true,
      intake_data: {
        submitted_at: new Date().toISOString(),
        nda_accepted: nda_accepted ?? false,
        tipo_pessoa: tipo_pessoa === "PF" || tipo_pessoa === "PJ" ? tipo_pessoa : null,
        comissao_aceita_pct: comissao_aceita_pct ? Number(comissao_aceita_pct) : null,
      },
    })
    .eq("id", demand.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Etapa 1 -> Etapa 2 (Fase 5, 5.3): formulario preenchido e reuniao inicial agendada.
  // Espelho do lado venda (app/api/cm/intake/[token]/route.ts). So age quando a demanda
  // ainda esta na entrada do funil (pendente): uma demanda que ja esta em outro estado
  // (ex.: cadastrada pela Mesa como "ativo") nunca e rebaixada por reenvio de formulario.
  // Best-effort -- nunca desfaz o envio ja confirmado ao comprador se a transicao ou a
  // notificacao falharem (a Mesa ainda ve a demanda na aba "Aguardando Formulario").
  if (demand.status === "pendente" || demand.status === "reuniao_validada") {
    try {
      const { data: filled } = await svc().rpc("transition_cm_demand_status", {
        p_demand_id: demand.id,
        p_new_status: "formulario_preenchido",
        p_reason: "Formulário de compra concluído pelo comprador.",
        p_user_id: demand.created_by ?? null,
      });
      if (!filled) {
        console.error(`[cm/intake/buy] demanda ${demand.id}: transicao para formulario_preenchido recusada`);
      } else {
        const label = demand.apelido || nome_contato;
        const isPartnerCreator = !!demand.created_by && demand.created_by === demand.origin_partner_id;
        const creatorUrl = isPartnerCreator ? "/meus-compradores" : "/bolsa/mesa";

        // 20/09/2026 (pedido de Joao): o agendamento automatico so roda com a chave
        // meeting_autotrigger LIGADA (desligada por padrao). Desligada, a demanda espera em
        // "Formulario preenchido" e o analista agenda pelo botao "Agendar reuniao".
        let scheduled = false;
        if (await getCmFlag(FLAG_MEETING_AUTOTRIGGER)) {
          const { data: meeting } = await svc().rpc("transition_cm_demand_status", {
            p_demand_id: demand.id,
            p_new_status: "reuniao_agendada",
            p_reason: "Intake concluído, agendamento automático da reunião inicial.",
            p_user_id: demand.created_by ?? null,
          });
          scheduled = !!meeting;
          if (scheduled) {
            await notifyMeetingLink({
              userId: demand.created_by,
              title: `Demanda ${label}: agende a reunião inicial`,
              intro: "O comprador concluiu o formulário.",
              actionUrl: creatorUrl,
            });
          }
        } else if (demand.created_by) {
          // Sem o gatilho automatico, avisa quem criou o link que o formulario chegou.
          const { error: nErr } = await svc().from("notifications").insert({
            user_id: demand.created_by,
            title: `Demanda ${label}: formulário concluído`,
            message: "O comprador concluiu o formulário. Use o botão Agendar reunião na demanda para marcar a reunião inicial com o Head.",
            type: "marketplace",
            action_url: creatorUrl,
            read: false,
          });
          if (nErr) console.error("[cm/intake/buy] falha ao avisar o criador:", nErr.message);
        }

        // Sem este aviso a demanda ficaria parada na fila sem ninguem da Mesa saber (ela
        // deixou de entrar direto no match). Se quem criou o link ja e da Mesa, ele acabou
        // de ser avisado acima; so a Mesa inteira quando o criador for partner ou desconhecido.
        let creatorIsMesa = false;
        if (demand.created_by) {
          const { data: creator } = await svc().from("profiles").select("role").eq("id", demand.created_by).maybeSingle();
          creatorIsMesa = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes((creator?.role as string) ?? "");
        }
        if (!creatorIsMesa) {
          await notifyByRoles(["ADMIN", "GESTAO", "MESA_OPERACIONAL"], {
            title: `Nova demanda de compra: ${label}`,
            message: scheduled
              ? "Formulário concluído. Aguardando reunião inicial e qualificação pela Mesa."
              : "Formulário concluído. Agende a reunião inicial pelo botão Agendar reunião na demanda.",
            type: "marketplace",
            action_url: "/bolsa/mesa",
          });
        }
      }
    } catch (transErr) {
      console.error("[cm/intake/buy] falha ao mover a demanda pelo pipeline:", transErr);
    }
  }

  // E-mail de confirmacao ao comprador -- ate 12/08/2026 esse envio simplesmente nao
  // existia, o unico sinal de "recebido" era a tela de confirmacao no navegador, que
  // desaparece se ele fechar a aba. Best-effort: nunca bloqueia a resposta de sucesso.
  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const ASSET_LABEL: Record<string, string> = {
        precatorio: "Precatório", direito_creditorio: "Direito Creditório",
        icms: "ICMS", ipi: "IPI", outros: "Outros",
      };
      const tiposLabel = (asset_types_preferidos ?? []).map((t: string) => ASSET_LABEL[t] ?? t).join(", ") || "não especificado";
      const subjectGate = auditText("Cadastro recebido — V3 Partners, Bolsa de Ativos");
      const htmlGate = auditHtml(`
        <p>Olá, <strong>${nome_contato}</strong>.</p>
        <p>Seu cadastro de interesse na Bolsa de Ativos V3 Partners foi recebido com sucesso.</p>
        <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
          <tr><td><strong>Tipo de ativo</strong></td><td>${tiposLabel}</td></tr>
          <tr><td><strong>Ticket</strong></td><td>R$ ${Number(ticket_min || 0).toLocaleString("pt-BR")} a R$ ${Number(ticket_max || 0).toLocaleString("pt-BR")}</td></tr>
        </table>
        <p>A equipe V3 Partners entrará em contato para agendar a reunião inicial e dar sequência à qualificação do seu cadastro.</p>
        <p style="margin-top:24px;color:#888;font-size:12px">V3 Partners Soluções Ltda — CNPJ 14.219.287/0001-50</p>
      `);
      if (htmlGate.blocking.length > 0) {
        console.error("[cm/intake/buy] Brand Guardian bloqueou e-mail de confirmacao:", htmlGate.blocking);
      } else {
        await resend.emails.send({
          from: "V3 Partners Bolsa de Ativos <deal@v3partners.com.br>",
          to: [email],
          subject: subjectGate.corrected,
          html: htmlGate.corrected,
        });
      }
    } catch (emailErr) {
      console.error("[cm/intake/buy] falha ao enviar e-mail de confirmacao:", emailErr);
    }
  }

  return NextResponse.json({
    success: true,
    message: "Cadastro de interesse recebido. A equipe V3 Partners entrará em contato para agendar a reunião inicial e dar sequência à qualificação do seu cadastro.",
  });
}
