import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

/** POST /api/marketplace/products/[id]/match-partners
 *  Called internally after a product is approved. Scores active PARTNER/PARTNER_PRO
 *  profiles and creates notifications for the top 5 matches.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Validate internal key
  const internalKey = req.headers.get("x-internal-key");
  if (internalKey !== (process.env.INTERNAL_API_KEY ?? "v3-internal")) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const svc = serviceClient();

  // 1. Get product details
  const { data: product, error: prodErr } = await svc
    .from("marketplace_products")
    .select("id, name, category, states, available_nationwide, status")
    .eq("id", id)
    .single();

  if (prodErr || !product) {
    return NextResponse.json({ error: "Produto não encontrado" }, { status: 404 });
  }

  // 2. Get all active PARTNER/PARTNER_PRO profiles
  const { data: partners, error: partErr } = await svc
    .from("profiles")
    .select("id, role, state, last_sign_in_at, metadata")
    .in("role", ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE"])
    .not("state", "is", null);

  if (partErr || !partners) {
    return NextResponse.json({ error: "Erro ao buscar partners" }, { status: 500 });
  }

  // 3. Fetch supporting data: leads and academy progress for scoring
  const partnerIds = partners.map((p: { id: string }) => p.id);

  const [leadsRes, academyRes] = await Promise.all([
    svc
      .from("crm_leads")
      .select("partner_id, category")
      .in("partner_id", partnerIds)
      .order("created_at", { ascending: false })
      .limit(500),
    svc
      .from("academy_certificates")
      .select("user_id, category")
      .in("user_id", partnerIds),
  ]);

  const recentLeads = leadsRes.data ?? [];
  const certs = academyRes.data ?? [];

  // Build lookup maps
  const leadCategoryByPartner: Record<string, Set<string>> = {};
  for (const lead of recentLeads) {
    if (!lead.partner_id) continue;
    if (!leadCategoryByPartner[lead.partner_id]) leadCategoryByPartner[lead.partner_id] = new Set();
    if (lead.category) leadCategoryByPartner[lead.partner_id].add(lead.category);
  }

  const certsByPartner: Record<string, string[]> = {};
  for (const cert of certs) {
    if (!cert.user_id) continue;
    if (!certsByPartner[cert.user_id]) certsByPartner[cert.user_id] = [];
    certsByPartner[cert.user_id].push(cert.category ?? "");
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const productStates: string[] = product.states ?? [];

  // 4. Score each partner
  type PartnerScore = { id: string; score: number };
  const scored: PartnerScore[] = partners.map((partner: {
    id: string;
    role: string;
    state: string | null;
    last_sign_in_at: string | null;
    metadata: Record<string, unknown> | null;
  }) => {
    let score = 0;

    // Category match in recent leads (+40 pts)
    const partnerLeadCats = leadCategoryByPartner[partner.id] ?? new Set<string>();
    if (partnerLeadCats.has(product.category)) score += 40;

    // Location match (+20 pts)
    if (product.available_nationwide || (partner.state && productStates.includes(partner.state))) {
      score += 20;
    }

    // Academy completion in relevant category (+20 pts)
    const partnerCerts = certsByPartner[partner.id] ?? [];
    if (partnerCerts.some((c) => c === product.category)) score += 20;

    // Recent activity: last login within 7 days (+20 pts)
    if (partner.last_sign_in_at && partner.last_sign_in_at >= sevenDaysAgo) score += 20;

    return { id: partner.id, score };
  });

  // Sort descending, take top 5
  const top5 = scored
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (top5.length === 0) {
    return NextResponse.json({ matched: 0, partners: [] });
  }

  // 5. Create notifications for each matched partner
  const notifications = top5.map((p) => ({
    user_id: p.id,
    type: "MARKETPLACE_MATCH",
    title: "Novo produto compatível com seu perfil!",
    message: `O produto "${product.name}" (${product.category}) foi adicionado ao marketplace e combina com o seu perfil.`,
    link: `/marketplace/${product.id}`,
    read: false,
  }));

  await svc.from("notifications").insert(notifications);

  return NextResponse.json({ matched: top5.length, partners: top5 });
}
