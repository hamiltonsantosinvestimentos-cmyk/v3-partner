import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Fase 5, sub-entrega 5.2 (19/09/2026, pedido de Joao): superficie visual
// sobre o motor de match ja existente (match_cm_listings_to_demands(),
// demand_matches). So mostra scores >= 50, o mesmo piso que o motor ja usa
// pra gravar um match real -- nunca calcula score novo aqui, so le o que
// o motor ja produziu.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const MESA_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !MESA_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });
  }

  const { data: listings } = await svc()
    .from("cm_asset_listings")
    .select("id, anonymous_id, apelido, asset_type, valor_face")
    .eq("listing_status", "ativo_vitrine")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: demands } = await svc()
    .from("investor_demands")
    .select("id, apelido, nome_contato")
    .eq("status", "ativo")
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: matches } = await svc()
    .from("demand_matches")
    .select("listing_id, demand_id, score, match_reasons, status")
    .not("listing_id", "is", null)
    .order("score", { ascending: false });

  return NextResponse.json({
    listings: (listings ?? []).map((l) => ({ ...l, label: l.apelido || l.anonymous_id })),
    // Duplo-cego (Fase 5): nunca devolve nome_contato pro cliente, so o apelido/codinome,
    // mesmo quando o role e Mesa -- a tela interna usa apelido de proposito, quem precisar
    // do nome real abre o cadastro do comprador direto.
    demands: (demands ?? []).map((d) => ({ id: d.id, label: d.apelido || "Demanda sem apelido" })),
    matches: matches ?? [],
  });
}
