import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapPhaseToStage, getCardField, parseBRCurrency } from "@/lib/pipefy-utils";

// Cliente com service role — não precisa de cookies (rota de webhook)
function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    // ── Validação de autenticidade do webhook Pipefy ──────────────────────────
    const webhookSecret = process.env.PIPEFY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[pipefy-webhook] PIPEFY_WEBHOOK_SECRET não configurado — rejeitando request");
      return NextResponse.json({ ok: false, error: "Webhook não configurado" }, { status: 503 });
    }
    const incomingToken =
      req.headers.get("x-pipefy-webhook-token") ??
      req.headers.get("authorization")?.replace("Bearer ", "");
    if (!incomingToken || incomingToken !== webhookSecret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const action: string = body.data?.action ?? body.action ?? "";
    const card = body.data?.card ?? body.card;

    // Processa qualquer evento que tenha card (create, move, done, update, etc.)
    if (!card) {
      return NextResponse.json({ ok: true, skipped: true, reason: "no card" });
    }

    const supabase = serviceClient();
    const fields: Array<{ field: { label: string }; value: string }> = card.fields ?? [];

    // ── Extrai dados do card ──────────────────────────────────────
    // Campos do formulário: "nome do cliente ou ativo", "nome do partner",
    //                       "valor estimado", "e-mail do contato"
    const company =
      getCardField(fields, "nome do cliente", "cliente ou ativo", "nome da empresa", "empresa", "company", "alvo", "target", "ativo") ?? card.title ?? "Sem nome";
    const rawValue = getCardField(fields, "valor estimado", "valor do deal", "valor do negocio", "valor", "value", "deal", "montante", "ticket", "preco", "preço");
    const dealValue = rawValue ? parseBRCurrency(rawValue) : null;
    const sector = getCardField(fields, "setor", "sector", "segmento", "industria", "indústria", "ramo");
    const contactEmail = getCardField(fields, "e-mail do contato", "email do contato", "e-mail", "email", "contato");
    const partnerName = getCardField(fields, "nome do partner", "nome partner", "partner", "parceiro", "responsavel", "responsável", "originador");
    const notes = getCardField(fields, "observ", "descri", "nota", "detalhe");

    const phaseName: string = card.current_phase?.name ?? "";
    const stage = mapPhaseToStage(phaseName);

    // ── Encontra o partner pelo nome (qualquer role — inclui PARTNER_PRO) ───────
    let partnerId: string | null = null;
    if (partnerName) {
      // Exato primeiro (case-insensitive)
      const { data: p1 } = await supabase
        .from("profiles").select("id")
        .ilike("full_name", partnerName.trim())
        .in("role", ["PARTNER", "PARTNER_PRO", "GESTAO", "ADMIN"])
        .limit(1).maybeSingle();
      if (p1?.id) {
        partnerId = p1.id;
      } else {
        // Parcial
        const { data: p2 } = await supabase
          .from("profiles").select("id")
          .ilike("full_name", `%${partnerName.trim()}%`)
          .in("role", ["PARTNER", "PARTNER_PRO", "GESTAO", "ADMIN"])
          .limit(1).maybeSingle();
        partnerId = p2?.id ?? null;
      }
    }

    // Fallback: tenta pelo e-mail do contato
    if (!partnerId && contactEmail) {
      const { data: profile } = await supabase
        .from("profiles").select("id")
        .ilike("email", contactEmail.trim())
        .limit(1).maybeSingle();
      partnerId = profile?.id ?? null;
    }


    // Precisa de um UUID válido para created_by — tenta admin/gestao, depois qualquer usuário
    let adminId: string | null = null;
    for (const role of ["ADMIN", "GESTAO", "MESA_OPERACIONAL"]) {
      const { data: u } = await supabase.from("profiles").select("id").eq("role", role).limit(1).maybeSingle();
      if (u?.id) { adminId = u.id; break; }
    }
    let createdBy = partnerId ?? adminId;
    if (!createdBy) {
      const { data: u } = await supabase.from("profiles").select("id").limit(1).maybeSingle();
      createdBy = u?.id ?? null;
    }
    if (!createdBy) {
      return NextResponse.json({ ok: false, error: "Nenhum usuário encontrado no banco" }, { status: 500 });
    }

    // ── Upsert no Supabase ────────────────────────────────────────
    const code = `MA-PIPEFY-${card.id}`;
    const { error } = await supabase
      .from("ma_deals")
      .upsert(
        {
          code,
          title: company,
          target_company: company,
          sector: sector ?? null,
          deal_value: dealValue,
          stage,
          notes: [
            notes,
            partnerName ? `Partner: ${partnerName}` : null,
            contactEmail ? `Contato: ${contactEmail}` : null,
          ].filter(Boolean).join("\n") || null,
          created_by: createdBy,
          assigned_to: partnerId ?? adminId ?? createdBy,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "code" }
      );

    if (error) {
      console.error("[Pipefy Webhook] Supabase error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, action, company, stage, partnerId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[Pipefy Webhook] Error:", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
