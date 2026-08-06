import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { createNotification, notifyByRoles } from "@/lib/notify";
import { issueV3Code, resolveSectorCode, insertWithLegacyCode } from "@/lib/v3-codes";

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
  stage:                  z.enum(["PROSPECTING","QUALIFICATION","IOI","PROPOSAL","DUE_DILIGENCE","NEGOTIATION","CLOSING","CLOSED_WON","CLOSED_LOST"]).optional(),
  probability_percent:    z.number().int().min(0).max(100).optional().nullable(),
  notes:                  z.string().max(2000).optional().nullable(),
  comments:               z.array(dealCommentSchema).optional(),
  assigned_to:            z.string().uuid().optional().nullable(),
  expected_close_date:    z.string().optional().nullable(),
  asset_data:             z.record(z.string(), z.unknown()).optional(),
  origin_vertical:        z.enum(ORIGIN_VERTICALS).optional(),
  originator_profile_id:  z.string().uuid().optional().nullable(),
});

// Monta select com join de partner — usa nome da coluna para evitar problema com nome do FK constraint
const DEAL_SELECT = `
  id, code, title, target_company, sector, deal_value, ebitda_multiple,
  stage, probability_percent, expected_close_date, created_at, updated_at,
  notes, comments, assigned_to, created_by, asset_data, location,
  partner:profiles!assigned_to(id, full_name)
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

  // Busca deal único por ID (para refresh de asset_data)
  if (id) {
    let q = svc.from("ma_deals").select(DEAL_SELECT).eq("id", id).is("deleted_at", null);
    if (!isAdmin) q = q.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
    const { data, error } = await q.single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json({ deal: data });
  }

  let query = svc.from("ma_deals").select(DEAL_SELECT).is("deleted_at", null).order("created_at", { ascending: false });

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

  const { id, ...fields } = parsed.data;
  const svc = serviceClient();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);

  if (!isAdmin) {
    const { data: existing } = await svc.from("ma_deals").select("assigned_to, created_by, originator_profile_id").eq("id", id).single();
    if (!existing || (existing.assigned_to !== user.id && existing.created_by !== user.id)) {
      return NextResponse.json({ error: "Sem permissão para editar este deal" }, { status: 403 });
    }
  }

  if (profile?.role === "MESA_OPERACIONAL" && (fields.asset_data !== undefined || fields.stage !== undefined)) {
    const { data: dealCheck } = await svc.from("ma_deals").select("originator_profile_id").eq("id", id).single();
    if (!dealCheck?.originator_profile_id) {
      console.error(`[ma-deals PATCH] GOVERNANCE_VIOLATION: MESA_OPERACIONAL ${user.id} tentou alterar deal ${id} sem originator_profile_id`);
      return NextResponse.json({
        error: "GOVERNANCE_VIOLATION: Deal sem originador associado. Associe um originador antes de alterar dados ou estágio.",
        code: "MISSING_ORIGINATOR",
      }, { status: 422 });
    }
  }

  const { data, error } = await svc
    .from("ma_deals")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, userName: profile?.full_name, action: "UPDATE", entity: "ma_deals", entityId: id, newData: fields as Record<string, unknown> });

  // Bridge B: Ma_deals → CRM (log de interação — fire-and-forget)
  // Princípio: CRM encerra em "ganho" quando lead é passado à Mesa.
  // A partir daí, apenas appendamos interações — NUNCA alteramos o status do lead.
  // Isso preserva os Kanbans de crédito, ENDI e outros módulos intactos.
  if (fields.stage && typeof fields.stage === "string") {
    const STAGE_LABELS: Record<string, string> = {
      PROSPECTING: "Prospecção", QUALIFICATION: "Qualificação",
      IOI: "Viabilidade",        PROPOSAL: "Estruturação",
      NEGOTIATION: "Negociação", DUE_DILIGENCE: "Due Diligence",
      CLOSING: "Closing",        CLOSED_WON: "Fechado — Ganho",
      CLOSED_LOST: "Encerrado",
    };
    const stageLabel = STAGE_LABELS[fields.stage];
    if (stageLabel) {
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
          notes: `Mesa M&A: deal avançou para "${stageLabel}".`,
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
              metadata:         { ma_deal_id: id, ma_code: (data as {code?: string})?.code },
            }));
          }
        }
      } catch (bridgeErr) {
        // Continua best-effort e não bloqueia o deal, mas a falha passa a
        // aparecer em log em vez de sumir num catch vazio.
        console.error("[ma-deals PATCH] Bridge B CRM lançou exceção:", bridgeErr);
      }
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
