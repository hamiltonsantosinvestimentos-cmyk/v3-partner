import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { notifyPartnerLinkAberto } from "@/lib/email";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — rastreia abertura do link /analise-v2?prop=<code>[&deal_type=ma],
// disparado pelo client no mount da landing (ver analise-landing-v2-client.tsx).
// Só grava evento quando há prop_code (link ligado a uma proposta de Crédito
// ou Deal de M&A específico) -- nunca para ?ref= solto (tráfego de marketing
// genérico), decisão de escopo do BRIEF 2026-09-14. Nunca derruba o
// carregamento da página: qualquer erro aqui responde 200 mesmo assim.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      prop_code?: string;
      deal_type?: "credit" | "ma";
      utm_source?: string | null;
      utm_campaign?: string | null;
      utm_medium?: string | null;
    };

    const propCode = body.prop_code?.trim().toUpperCase();
    if (!propCode) return NextResponse.json({ ok: true });

    const dealType: "credit" | "ma" = body.deal_type === "ma" ? "ma" : "credit";
    const db = svc();

    let creditDeskProposalId: string | null = null;
    let maDealId: string | null = null;
    let partnerId: string | null = null;

    if (dealType === "ma") {
      const { data: deal } = await db.from("ma_deals").select("id, created_by").eq("code", propCode).is("deleted_at", null).single();
      if (deal) { maDealId = deal.id; partnerId = deal.created_by ?? null; }
    } else {
      const { data: prop } = await db.from("credit_desk_proposals").select("id, partner_id").eq("code", propCode).single();
      if (prop) { creditDeskProposalId = prop.id; partnerId = prop.partner_id ?? null; }
    }

    // Primeira abertura registrada para este código dispara notificação ao
    // partner; reaberturas (F5, novo acesso) continuam sendo logadas para
    // estatística, mas não geram um novo aviso a cada uma.
    const { count } = await db
      .from("analise_link_opens")
      .select("id", { count: "exact", head: true })
      .eq("prop_code", propCode);
    const isFirstOpen = (count ?? 0) === 0;

    await db.from("analise_link_opens").insert({
      prop_code: propCode,
      deal_type: dealType,
      credit_desk_proposal_id: creditDeskProposalId,
      ma_deal_id: maDealId,
      partner_id: partnerId,
      utm_source: body.utm_source ?? null,
      utm_campaign: body.utm_campaign ?? null,
      utm_medium: body.utm_medium ?? null,
    });

    if (isFirstOpen && partnerId) {
      const { data: partner } = await db.from("profiles").select("full_name, email").eq("id", partnerId).single();
      if (partner?.email) {
        await db.from("notifications").insert({
          user_id: partnerId,
          type: "commission",
          title: "Seu link de Análise foi aberto",
          message: `O link de Análise de Crédito/M&A que você enviou (código ${propCode}) acabou de ser aberto pelo destinatário.`,
          action_url: dealType === "ma" ? "/mesa-ma" : "/mesa-credito/nivel-1",
          read: false,
        }).then(null, () => {});

        await notifyPartnerLinkAberto({
          partnerEmail: partner.email,
          partnerName: partner.full_name ?? "Partner",
          propCode,
          dealType,
        }).catch((e) => console.error("Email error (link aberto):", e));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("track-open error:", e);
    return NextResponse.json({ ok: true });
  }
}
