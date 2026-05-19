import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function logScale(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.min(max, Math.round((Math.log(value + 1) / Math.log(101)) * max));
}

export interface PartnerScoreResult {
  score: number;
  tier: string;
  tier_color: string;
  badge_label: string;
  breakdown: {
    commissions_closed: number;
    commission_volume: number;
    leads_converted: number;
    academy_certs: number;
    crm_activity: number;
  };
}

function getTier(score: number): { tier: string; tier_color: string; badge_label: string } {
  if (score <= 20) return { tier: "iniciando",    tier_color: "gray",    badge_label: "Iniciando" };
  if (score <= 40) return { tier: "construindo",  tier_color: "bronze",  badge_label: "Construindo" };
  if (score <= 60) return { tier: "ativo",        tier_color: "silver",  badge_label: "Ativo" };
  if (score <= 80) return { tier: "expert",       tier_color: "gold",    badge_label: "Expert" };
  return               { tier: "elite",           tier_color: "diamond", badge_label: "Elite V3" };
}

/** GET /api/marketplace/partner-score?partner_id=xxx
 *  Returns a partner's public score and breakdown.
 *  If partner_id is omitted, uses the authenticated user.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const partnerId = searchParams.get("partner_id") ?? user.id;
  const svc = serviceClient();

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch data in parallel
  const [commissionsRes, marketplaceLeadsRes, certsRes, crmRes] = await Promise.all([
    svc
      .from("partner_commissions")
      .select("id, amount, status")
      .eq("partner_id", partnerId)
      .eq("status", "PAID"),
    svc
      .from("marketplace_leads")
      .select("id, status")
      .eq("partner_id", partnerId),
    svc
      .from("academy_certificates")
      .select("id, category")
      .eq("user_id", partnerId)
      .limit(10),
    svc
      .from("crm_leads")
      .select("id, updated_at")
      .eq("partner_id", partnerId)
      .gte("updated_at", thirtyDaysAgo),
  ]);

  const commissions = commissionsRes.data ?? [];
  const mktLeads = marketplaceLeadsRes.data ?? [];
  const certs = certsRes.data ?? [];
  const crmActivity = crmRes.data ?? [];

  // Score components
  const commissionsCount = commissions.length;
  const commissionVolume = commissions.reduce((sum: number, c: { amount: number }) => sum + (c.amount ?? 0), 0);

  const totalLeads = mktLeads.length;
  const convertedLeads = mktLeads.filter((l: { status: string }) => l.status === "CONVERTED").length;
  const conversionRate = totalLeads > 0 ? convertedLeads / totalLeads : 0;

  const certCount = Math.min(certs.length, 3);
  const activeCrmLeads = crmActivity.length;

  // Points
  const commissionsClosedPts = logScale(commissionsCount, 30);
  const commissionVolumePts = logScale(Math.floor(commissionVolume / 1000), 25);
  const leadsConvertedPts = Math.round(conversionRate * 20);
  const academyCertsPts = certCount * 5;
  const crmActivityPts = Math.min(10, Math.round((activeCrmLeads / 5) * 10));

  const total = Math.min(
    100,
    commissionsClosedPts + commissionVolumePts + leadsConvertedPts + academyCertsPts + crmActivityPts
  );

  const tier = getTier(total);

  const result: PartnerScoreResult = {
    score: total,
    ...tier,
    breakdown: {
      commissions_closed: commissionsClosedPts,
      commission_volume: commissionVolumePts,
      leads_converted: leadsConvertedPts,
      academy_certs: academyCertsPts,
      crm_activity: crmActivityPts,
    },
  };

  return NextResponse.json(result);
}
