import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { createNotification, notifyByRoles } from "@/lib/notify";
import { issueV3Code, resolveSectorCode, insertWithLegacyCode } from "@/lib/v3-codes";
import { anexarTransferencias } from "@/lib/ma/transferir-mesa";
import {
  LOSS_CATEGORIES, MIN_REASON_LENGTH, DB_TO_PIPELINE, STAGE_DEFAULT_PROBABILITY,
  classifyTransition, stageRoleDenial, validateClosedDate, todaySaoPaulo, isoToBr,
  dbStageLabel, lossCategoryLabel, crossesCreditGate, WORKING_DB_STAGES, CLOSED_DB_STAGES,
  type TransitionKind,
} from "@/lib/ma/pipeline";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null, supabase };
  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile, supabase };
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const ORIGIN_VERTICALS = ["MA", "Credito", "Consorcios"] as const;

// Gate obrigatório de Análise de Crédito (09/09/2026): estende pra M&A o mesmo mecanismo já em
// produção pra Mesa de Crédito desde 26/08/2026 (app/api/credit-proposals/route.ts). Ponto de
// corte em lib/ma/pipeline.ts (crossesCreditGate): entrada do Mandato desde o bloco E (29/10/2026).

const createSchema = z.object({
  company:                z.string().min(1, "Nome da empresa obrigatório").max(200),
  title:                  z.string().max(300).optional(),
  sector:                 z.string().max(100).optional().nullable(),
  value:                  z.number().nonnegative().optional().nullable(),
  notes:                  z.string().max(5000).optional().nullable(),
  code:                   z.string().max(50).optional(),
  tipo_participante:      z.enum(["Vendedor", "Investidor"]).optional(),
  location:               z.string().max(200).optional().nullable(),
  asset_data:             z.record(z.string(), z.unknown()).optional(),
  probability_percent:    z.number().int().min(0).max(100).optional(),
  assigned_to:            z.string().uuid().optional(),
  origin_vertical:        z.enum(ORIGIN_VERTICALS).optional(),
  originator_profile_id:  z.string().uuid().optional(),
});

const dealCommentSchema = z.object({
  id:         z.string(),
  text:       z.string().max(2000),
  author:     z.string().max(100),
  created_at: z.string(),
});

const patchSchema = z.object({
  id:                     z.string().uuid("ID inválido"),
  target_company:         z.string().min(1).max(200).optional(),
  sector:                 z.string().max(100).optional().nullable(),
  location:               z.string().max(200).optional().nullable(),
  deal_value:             z.number().positive().optional().nullable(),
  stage:                  z.enum([...WORKING_DB_STAGES, ...CLOSED_DB_STAGES] as [string, ...string[]]).optional(),
  probability_percent:    z.number().int().min(0).max(100).optional().nullable(),
  notes:                  z.string().max(2000).optional().nullable(),
  comments:               z.array(dealCommentSchema).optional(),
  assigned_to:            z.string().uuid().optional().nullable(),
  expected_close_date:    z.string().optional().nullable(),
  asset_data:             z.record(z.string(), z.unknown()).optional(),
  origin_vertical:        z.enum(ORIGIN_VERTICALS).optional(),
  originator_profile_id:  z.string().uuid().optional().nullable(),
  // Mudança de fase (BRIEF 28/10/2026, bloco B): justificativa de salto ou motivo de reabertura,
  // e os campos de encerramento (Ganho/Perdido). Autoria e horário vêm sempre do servidor.
  transition_reason:      z.string().max(2000).optional(),
  closed_date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data no formato AAAA-MM-DD").optional(),
  closed_reason_category: z.enum(LOSS_CATEGORIES.map(c => c.value) as [string, ...string[]]).optional(),
  closed_reason:          z.string().max(2000).optional(),
  closed_note:            z.string().max(2000).optional(),
});

// Monta select com join de partner — usa nome da coluna para evitar problema com nome do FK constraint
const DEAL_SELECT = `
  id, code, title, target_company, sector, deal_value, ebitda_multiple,
  stage, probability_percent, expected_close_date, created_at, updated_at,
  notes, comments, assigned_to, created_by, asset_data, location,
  partner:profiles!assigned_to(id, full_name)
`;

// Campos de encerramento só para a Mesa (ADMIN, GESTAO, MESA_OPERACIONAL), nunca para partner.
const DEAL_SELECT_MESA = `${DEAL_SELECT},
  closed_date, closed_at, closed_from_stage, closed_reason_category, closed_reason, closed_note,
  closer:profiles!closed_by(full_name)
`;

// GET — lista deals (partner vê os seus, admin vê todos)
export async function GET(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { searchParams } = new URL(req.url);
  const stage = searchParams.get("stage");
  const id = searchParams.get("id");
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  const select = isAdmin ? DEAL_SELECT_MESA : DEAL_SELECT;

  // Busca deal único por ID (para refresh de asset_data)
  if (id) {
    let q = svc.from("ma_deals").select(select).eq("id", id).is("deleted_at", null);
    if (!isAdmin) q = q.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
    const { data, error } = await q.single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    // Selo da transferência entre mesas: só a equipe recebe (o partner nunca vê a mesa de destino).
    if (isAdmin && data) {
      const [comTransf] = await anexarTransferencias(svc, [data as unknown as { id: string }]);
      return NextResponse.json({ deal: { ...(data as object), transferencias: comTransf.transferencias } });
    }
    return NextResponse.json({ deal: data });
  }

  let query = svc.from("ma_deals").select(select).is("deleted_at", null).order("created_at", { ascending: false });

  if (!isAdmin) {
    query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
  }
  if (stage) {
    query = query.eq("stage", stage.toUpperCase());
  }

  const { data, error } = await query;
  if (error) {
    console.error("[ma-deals GET] error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (isAdmin) {
    const comTransf = await anexarTransferencias(svc, (data ?? []) as unknown as { id: string }[]);
    return NextResponse.json({ deals: comTransf });
  }
  return NextResponse.json({ deals: data ?? [] });
}

// POST — cria novo deal M&A
export async function POST(req: NextRequest) {
  try {
    const { user, profile } = await getAuthedUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: JSON.stringify(parsed.error.flatten().fieldErrors) }, { status: 400 });
    }
    const d = parsed.data;

    const svcPost = serviceClient();

    // Codigo emitido pelo banco (funcao next_v3_code), nunca calculado aqui.
    // O calculo anterior usava COUNT(*)+1, que colide assim que existe qualquer
    // vao na numeracao: em 05/08/2026 a tabela tinha 29 linhas e o maior codigo
    // era MA-26-030, entao COUNT+1 devolvia um codigo que ja existia e todo
    // cadastro de deal falhava com 23505.
    // O setor entra no codigo resolvido contra deal_sector_codes, e nao mais no
    // chute: era assim que MAC e CRE acabaram emitidos fora do dicionario.
    const sectorCode = await resolveSectorCode(d.sector, svcPost);
    // Truthiness, não `??`: um chamador que mande code:"" gravaria código em
    // branco, porque `??` só intercepta null e undefined.
    const code = d.code || (await issueV3Code("MA", sectorCode, svcPost));
    const codeWasIssued = !d.code;

    function deriveVertical(sector: string | null | undefined): "MA" | "Credito" | "Consorcios" {
      const s = (sector ?? "").toLowerCase();
      if (s.includes("credito") || s.includes("recebiv")) return "Credito";
      if (s.includes("consorcio") || s.includes("consórcio")) return "Consorcios";
      return "MA";
    }

    const insertPayload = {
      code,
      // v3_code so e preenchido quando o codigo foi emitido aqui. Se o chamador
      // trouxe um codigo proprio, nao presumimos que ele siga a taxonomia V3.
      ...(codeWasIssued ? { v3_code: code } : {}),
      title:                  d.title ?? d.company,
      target_company:         d.company,
      sector:                 d.sector ?? null,
      deal_value:             d.value ?? null,
      stage:                  "PROSPECTING" as const,
      probability_percent:    d.probability_percent ?? 10,
      notes:                  d.notes ?? null,
      assigned_to:            d.assigned_to ?? user.id,
      created_by:             user.id,
      location:               d.location ?? null,
      origin_vertical:        d.origin_vertical ?? deriveVertical(d.sector),
      originator_profile_id:  d.originator_profile_id ?? user.id,
      asset_data: {
        ...(d.tipo_participante ? { tipo_participante: d.tipo_participante } : {}),
        ...(d.asset_data ?? {}),
      },
    };

    const { data, error } = await svcPost
      .from("ma_deals")
      .insert(insertPayload)
      .select("id, code, target_company, sector, deal_value, probability_percent, created_at, notes, assigned_to")
      .single();

    if (error) {
      console.error("[ma-deals POST] Supabase error:", JSON.stringify(error));
      return NextResponse.json({ error: `${error.message} | ${error.details ?? ""} | code: ${error.code ?? ""}` }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: "Nenhum dado retornado após inserção" }, { status: 500 });
    }

    logAudit({
      userId: user.id, userName: profile?.full_name,
      action: "CREATE", entity: "ma_deals", entityId: data.id,
      newData: { code, company: d.company, assigned_to: insertPayload.assigned_to },
    });

    // Bridge A — CRM: cria lead como Prospecção (awaited para garantir execução em serverless)
    // Permite que o parceiro acompanhe o deal no CRM antes da Mesa assumir.
    try {
      const svcCrm = serviceClient();
      // Anti-duplicata: verifica se já existe lead M&A para este partner + empresa
      const { data: dup } = await svcCrm
        .from("crm_leads")
        .select("id")
        .eq("partner_id", insertPayload.assigned_to)
        .eq("name", d.company)
        .eq("credit_line", "M&A")
        .limit(1);

      if (!dup || dup.length === 0) {
        // MAX real + retry no 23505, nunca COUNT(*). Mesmo defeito que derrubou
        // o cadastro por link de captação em 31/07/2026.
        const { error: leadErr } = await insertWithLegacyCode(
          svcCrm,
          "crm_leads",
          "CRM-26",
          (leadCode) => ({
            code:             leadCode,
            name:             d.company,
            person_type:      "PJ",
            segment:          d.sector ?? "M&A",
            annual_revenue:   d.value ?? 0,
            status:           "prospect",      // Prospecção — parceiro pode acompanhar no CRM
            source:           "ativo",
            product_interest: "ma",
            credit_line:      "M&A",
            partner_id:       insertPayload.assigned_to,
            created_by:       user.id,
            converted_to:     "ma",
            interactions:     [{
              id:         `intake-${Date.now()}`,
              date:       new Date().toISOString().split("T")[0],
              type:       "email",
              notes:      `Deal ${code} cadastrado na Mesa M&A — aguardando qualificação.`,
              author:     profile?.full_name ?? "Mesa V3",
            }],
            metadata: { ma_deal_id: data.id, ma_code: code },
          })
        );
        // O CRM continua sendo best-effort e não bloqueia o deal, mas a falha
        // deixa de ser invisível: antes este bloco inteiro morria dentro de um
        // catch vazio, que foi como o defeito ficou latente por meses.
        if (leadErr) {
          console.error(`[ma-deals POST] Bridge A CRM falhou para o deal ${code}:`, leadErr.message);
        }
      }
    } catch (bridgeErr) {
      console.error("[ma-deals POST] Bridge A CRM lançou exceção:", bridgeErr);
    }

    // Notificações in-app (fire-and-forget)
    const partnerName = profile?.full_name ?? "Partner";
    // Confirmação para o próprio partner
    createNotification({
      user_id: user.id,
      type: "deal",
      title: "Deal enviado para análise",
      message: `${code} — ${d.company} foi recebido pela Mesa M&A`,
      action_url: "/ma",
    });
    // Alerta para ADMIN e GESTAO
    notifyByRoles(["ADMIN", "GESTAO"], {
      type: "deal",
      title: `Novo Deal M&A — ${code}`,
      message: `${partnerName} cadastrou: ${d.company}${d.sector ? ` · ${d.sector}` : ""}`,
      action_url: `/mesa-ma?deal=${data.id}`,
    });

    return NextResponse.json({
      ok: true,
      card: {
        id:          data.id,
        code:        data.code,
        company:     data.target_company,
        sector:      data.sector ?? "",
        value:       data.deal_value ?? 0,
        stage:       "prospeccao",
        responsible: profile?.full_name ?? "Partner",
        probability: data.probability_percent ?? 10,
        createdAt:   data.created_at?.split("T")[0] ?? "",
        notes:       data.notes ?? "",
        assigned_to: data.assigned_to,
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ma-deals POST] Uncaught exception:", msg);
    return NextResponse.json({ error: `Exceção interna: ${msg}` }, { status: 500 });
  }
}

// PATCH — atualiza deal
export async function PATCH(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const {
    id, stage: targetStage, transition_reason, closed_date, closed_reason_category, closed_reason, closed_note,
    ...fields
  } = parsed.data;
  const svc = serviceClient();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  // Autorizar avanço sem a Análise de Crédito paga (gate abaixo) é decisão
  // exclusiva de ADMIN -- nem GESTAO nem MESA_OPERACIONAL, apesar de estarem
  // em ADMIN_ROLES pro resto deste endpoint. Mesmo critério de
  // app/api/credit-proposals/route.ts (26/08/2026). ma_deals não tem coluna
  // "metadata" -- asset_data é o campo jsonb livre equivalente aqui.
  if (fields.asset_data && typeof fields.asset_data === "object" && "analise_gate_override" in fields.asset_data) {
    if (profile?.role !== "ADMIN") {
      return NextResponse.json({ error: "Somente um usuário ADMIN pode autorizar o avanço sem a Análise de Crédito paga" }, { status: 403 });
    }
    // Autoria vem do servidor, nunca do que o cliente mandou.
    (fields.asset_data as Record<string, unknown>).analise_gate_override = {
      by: user.id,
      by_name: profile.full_name,
      at: new Date().toISOString(),
    };
  }

  // Fase do deal é conduzida pela Mesa (BRIEF 28/10/2026, decisão do João): partner,
  // mesmo dono do deal, recebe 403 em qualquer alteração de stage.
  if (targetStage && !isAdmin) {
    return NextResponse.json({ error: "A fase do deal é conduzida pela Mesa M&A." }, { status: 403 });
  }

  if (!isAdmin) {
    const { data: existing } = await svc.from("ma_deals").select("assigned_to, created_by, originator_profile_id").eq("id", id).single();
    if (!existing || (existing.assigned_to !== user.id && existing.created_by !== user.id)) {
      return NextResponse.json({ error: "Sem permissão para editar este deal" }, { status: 403 });
    }
  }

  if (profile?.role === "MESA_OPERACIONAL" && (fields.asset_data !== undefined || targetStage !== undefined)) {
    const { data: dealCheck } = await svc.from("ma_deals").select("originator_profile_id").eq("id", id).single();
    if (!dealCheck?.originator_profile_id) {
      console.error(`[ma-deals PATCH] GOVERNANCE_VIOLATION: MESA_OPERACIONAL ${user.id} tentou alterar deal ${id} sem originator_profile_id`);
      return NextResponse.json({
        error: "GOVERNANCE_VIOLATION: Deal sem originador associado. Associe um originador antes de alterar dados ou estágio.",
        code: "MISSING_ORIGINATOR",
      }, { status: 422 });
    }
  }

  // ── Mudança de fase (BRIEF 28/10/2026, bloco B) ──────────────────────────────
  // Regra, papel e campos validados aqui; a gravação de fase + histórico é atômica
  // em ma_deal_transition() (migration 20261028a). Se a função falhar, nada é gravado.
  let transition: { kind: TransitionKind; from: string; to: string; reason?: string; category?: string } | null = null;
  if (targetStage) {
    const { data: current } = await svc
      .from("ma_deals")
      .select("stage, asset_data, closed_from_stage, contract_status")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (!current) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

    const from = current.stage as string;
    const kind = classifyTransition(from, targetStage, current.closed_from_stage as string | null);

    if (kind !== "same") {
      if (kind === "invalid") {
        return NextResponse.json({
          error: from === "CLOSED_WON" || from === "CLOSED_LOST"
            ? `Deal encerrado só pode ser reaberto para a fase de origem (${dbStageLabel(current.closed_from_stage as string | null)}).`
            : "Transição de fase inválida.",
        }, { status: 422 });
      }
      if (kind === "won_invalid") {
        return NextResponse.json({ error: "Ganho só a partir de \"Fechamento\"." }, { status: 422 });
      }
      const denial = stageRoleDenial(profile?.role, kind);
      if (denial) return NextResponse.json({ error: denial }, { status: 403 });

      const reason = (transition_reason ?? "").trim();
      if ((kind === "skip" || kind === "reopen_won" || kind === "reopen_lost") && reason.length < MIN_REASON_LENGTH) {
        return NextResponse.json({
          error: kind === "skip"
            ? `Para pular fase, informe a justificativa (mínimo de ${MIN_REASON_LENGTH} caracteres).`
            : `Informe o motivo da reabertura (mínimo de ${MIN_REASON_LENGTH} caracteres).`,
        }, { status: 422 });
      }

      let closedIso = todaySaoPaulo();
      if (kind === "won" || kind === "lost") {
        if (closed_date) closedIso = closed_date;
        const dateErr = validateClosedDate(closedIso);
        if (dateErr) return NextResponse.json({ error: dateErr }, { status: 422 });
      }
      const lostReason = (closed_reason ?? "").trim();
      if (kind === "lost" && (!closed_reason_category || lostReason.length < MIN_REASON_LENGTH)) {
        return NextResponse.json({ error: `Para marcar como Perdido, escolha a categoria e descreva o motivo (mínimo de ${MIN_REASON_LENGTH} caracteres).` }, { status: 422 });
      }

      // Gate Análise de Crédito: entrar no Mandato (ou saltar por ele) exige a Análise de Crédito
      // do cliente paga (partner_service_orders vinculado via ma_deal_id) OU autorização explícita
      // de um ADMIN (asset_data.analise_gate_override, ver guard acima). Só barra avanço de
      // verdade: retroceder, encerrar e reabrir não.
      if ((kind === "advance" || kind === "skip") && crossesCreditGate(from, targetStage)) {
        const existingAssetData = (current.asset_data as Record<string, unknown>) ?? {};
        const overriddenNow = fields.asset_data && typeof fields.asset_data === "object" && "analise_gate_override" in fields.asset_data;
        if (!existingAssetData.analise_gate_override && !overriddenNow) {
          const { data: paidOrder } = await svc
            .from("partner_service_orders")
            .select("id")
            .eq("ma_deal_id", id)
            .eq("status", "PAID")
            .limit(1)
            .maybeSingle();
          if (!paidOrder) {
            return NextResponse.json(
              { error: "Entrada no Mandato bloqueada: a Análise de Crédito do cliente ainda está pendente de pagamento. Gere o link no deal ou peça autorização a um ADMIN." },
              { status: 422 }
            );
          }
        }
      }

      const nowIso = new Date().toISOString();
      const toLabel = dbStageLabel(targetStage);
      let notes: string | null = null;
      // Campos closed_* ficam nulos fora de Ganho/Perdido (reabrir limpa; o histórico guarda tudo).
      let pFields: Record<string, unknown> = {
        probability_percent: STAGE_DEFAULT_PROBABILITY[DB_TO_PIPELINE[targetStage]] ?? null,
      };

      if (kind === "skip") notes = `Salto de fase para ${toLabel}. Justificativa: ${reason}`;
      if (kind === "back") notes = `Retrocesso de ${dbStageLabel(from)} para ${toLabel}.`;
      if (kind === "reopen_won" || kind === "reopen_lost") {
        notes = `Reaberto (${kind === "reopen_won" ? "Ganho" : "Perdido"}) para ${toLabel}. Motivo: ${reason}`;
      }
      if (kind === "won") {
        // Status anterior de cada cliente vinculado, para auditoria de uma reabertura futura (seção 4.5).
        const { data: clients } = await svc.from("ma_deal_clients").select("v3_client_id, status").eq("deal_id", id);
        const prev = (clients ?? []).map(c => `${c.v3_client_id}: ${c.status}`).join("; ");
        const note = (closed_note ?? "").trim();
        notes = `Ganho em ${isoToBr(closedIso)}.${note ? ` Observação: ${note}` : ""}${prev ? ` Status anterior dos clientes: ${prev}.` : ""}`;
        pFields = {
          probability_percent: 100, closed_date: closedIso, closed_at: nowIso, closed_by: user.id,
          closed_from_stage: from, closed_note: note || null,
        };
      }
      if (kind === "lost") {
        notes = `Perdido em ${isoToBr(closedIso)}. Categoria: ${lossCategoryLabel(closed_reason_category)}. Motivo: ${lostReason}`;
        pFields = {
          probability_percent: 0, closed_date: closedIso, closed_at: nowIso, closed_by: user.id,
          closed_from_stage: from, closed_reason_category, closed_reason: lostReason,
        };
      }

      const { error: rpcErr } = await svc.rpc("ma_deal_transition", {
        p_deal_id: id, p_to_stage: targetStage, p_changed_by: user.id, p_notes: notes, p_fields: pFields,
      });
      if (rpcErr) {
        console.error("[ma-deals PATCH] ma_deal_transition falhou:", rpcErr.message);
        return NextResponse.json({ error: "Não foi possível mudar a fase. Nada foi gravado." }, { status: 500 });
      }
      transition = { kind, from, to: targetStage, reason, category: closed_reason_category };

      // Client 360, Fase B (10-11/08/2026): deal Ganho promove os clientes vinculados a
      // "performado". Reabertura de Ganho (só ADMIN) rebaixa para "a_performar" se o deal
      // tem contrato assinado, senão para "prospecto" (BRIEF 28/10/2026, seção 4.5).
      if (kind === "won") {
        const { error: cliErr } = await svc
          .from("ma_deal_clients")
          .update({ status: "performado", updated_at: nowIso })
          .eq("deal_id", id)
          .neq("status", "performado");
        if (cliErr) console.error("[ma-deals PATCH] promoção do Cliente 360 falhou:", cliErr.message);
      }
      if (kind === "reopen_won") {
        let signed = current.contract_status === "SIGNED";
        if (!signed) {
          const { data: signedContract } = await svc
            .from("operation_contracts")
            .select("id")
            .eq("deal_id", id)
            .eq("status_signature", "assinado")
            .limit(1)
            .maybeSingle();
          signed = !!signedContract;
        }
        const { error: cliErr } = await svc
          .from("ma_deal_clients")
          .update({ status: signed ? "a_performar" : "prospecto", updated_at: nowIso })
          .eq("deal_id", id)
          .eq("status", "performado");
        if (cliErr) console.error("[ma-deals PATCH] reversão do Cliente 360 falhou:", cliErr.message);
      }
    }
  }

  // Demais campos do deal (fase e probabilidade de fase já gravadas pela transição).
  if (transition) delete fields.probability_percent;
  let data: Record<string, unknown> | null = null;
  if (Object.keys(fields).length > 0) {
    const { data: upd, error } = await svc
      .from("ma_deals")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data = upd;
  } else {
    const { data: row, error } = await svc.from("ma_deals").select().eq("id", id).single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    data = row;
  }

  logAudit({
    userId: user.id, userName: profile?.full_name, action: "UPDATE", entity: "ma_deals", entityId: id,
    newData: { ...(fields as Record<string, unknown>), ...(transition ? { stage_from: transition.from, stage: transition.to, transition: transition.kind } : {}) },
  });

  // Bridge B: Ma_deals → CRM (log de interação)
  // Princípio: CRM encerra em "ganho" quando lead é passado à Mesa.
  // A partir daí, apenas appendamos interações — NUNCA alteramos o status do lead.
  // Isso preserva os Kanbans de crédito, ENDI e outros módulos intactos.
  if (transition) {
    const toLabel = dbStageLabel(transition.to);
    const crmNote =
      transition.kind === "won" ? "Mesa M&A: deal marcado como Ganho." :
      transition.kind === "lost" ? `Mesa M&A: deal marcado como Perdido (${lossCategoryLabel(transition.category)}).` :
      transition.kind === "reopen_won" || transition.kind === "reopen_lost" ? `Mesa M&A: deal reaberto para ${toLabel}. Motivo: ${transition.reason}` :
      transition.kind === "back" ? `Mesa M&A: deal voltou para "${toLabel}".` :
      `Mesa M&A: deal avançou para "${toLabel}".`;
    try {
      // Busca lead M&A vinculado a este deal (criado pela Bridge A ou B)
      const { data: maLeads } = await svc
        .from("crm_leads")
        .select("id, interactions")
        .contains("metadata", { ma_deal_id: id })
        .eq("credit_line", "M&A")
        .in("source", ["hub", "mesa_ma"])
        .limit(1);

      const newInteraction = {
        id: `mesa-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        type: "email",
        notes: crmNote,
        author: profile?.full_name ?? "Mesa V3",
      };

      if (maLeads && maLeads.length > 0) {
        // Lead existe — apenas appenda interação, status permanece como está
        const current = maLeads[0] as { id: string; interactions: unknown[] };
        const updatedInteractions = [...(Array.isArray(current.interactions) ? current.interactions : []), newInteraction];
        await svc.from("crm_leads")
          .update({ interactions: updatedInteractions })
          .eq("id", current.id);
      } else if (data && (data as { assigned_to?: string; target_company?: string }).assigned_to) {
        // Lead não existe — cria como "ganho" (já chegou à Mesa) com primeira interação
        const deal = data as { assigned_to: string; target_company?: string; sector?: string; deal_value?: number; code?: string };
        const companyName = deal.target_company ?? `Deal ${deal.code ?? id.slice(0, 8)}`;

        // Anti-duplicata: não criar se já existe lead M&A para este partner + empresa
        const { data: dup } = await svc
          .from("crm_leads").select("id")
          .eq("partner_id", deal.assigned_to)
          .eq("name", companyName)
          .eq("credit_line", "M&A")
          .limit(1);

        if (!dup || dup.length === 0) {
          // MAX real + retry no 23505, nunca COUNT(*).
          await insertWithLegacyCode(svc, "crm_leads", "CRM-26", (leadCode) => ({
            code:             leadCode,
            name:             companyName,
            person_type:      "PJ",
            segment:          deal.sector ?? "M&A",
            annual_revenue:   deal.deal_value ?? 0,
            status:           "qualificado",    // Bridge via PATCH = já qualificado pela Mesa
            source:           "mesa_ma",
            product_interest: "ma",
            credit_line:      "M&A",
            converted_to:     "ma",
            partner_id:       deal.assigned_to,
            created_by:       user.id,
            interactions:     [newInteraction], // primeira interação já registrada
            metadata:         { ma_deal_id: id, ma_code: deal.code },
          }));
        }
      }
    } catch (bridgeErr) {
      // Continua best-effort e não bloqueia o deal, mas a falha passa a
      // aparecer em log em vez de sumir num catch vazio.
      console.error("[ma-deals PATCH] Bridge B CRM lançou exceção:", bridgeErr);
    }
  }

  // Notificação quando comentário é adicionado — fire-and-forget, não bloqueia resposta
  if (fields.comments !== undefined && fields.comments.length > 0) {
    const last = fields.comments[fields.comments.length - 1];
    const preview = last.text.length > 80 ? `${last.text.slice(0, 80)}…` : last.text;
    const dealCode = (data as { code?: string } | null)?.code ?? id.slice(0, 8);
    void notifyByRoles(["ADMIN", "GESTAO"], {
      type: "deal",
      title: `Comentário — ${dealCode}`,
      message: `${last.author}: "${preview}"`,
      action_url: `/mesa-ma?deal=${id}`,
    });
  }

  return NextResponse.json({ ok: true, deal: data });
}

// DELETE — somente ADMIN
// DELETE — descontinuado: exclusão de deal agora passa por soft delete +
// governança em POST /api/ma-deals/[id]/delete (ver lib/governance-delete.ts).
export async function DELETE() {
  return NextResponse.json(
    { error: "Use POST /api/ma-deals/{id}/delete — exclusão direta foi descontinuada (soft delete + governança)" },
    { status: 410 }
  );
}
