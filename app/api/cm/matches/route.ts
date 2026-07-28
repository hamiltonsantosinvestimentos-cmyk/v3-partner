import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await getCallerRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const listingId = searchParams.get("listing_id");

  let query = svc()
    .from("demand_matches")
    .select(`
      *,
      investor_demands(nome_contato, email, empresa, setores, ticket_min, ticket_max),
      cm_asset_listings:listing_id!inner(anonymous_id, asset_type, valor_face, desagio_pretendido, listing_status)
    `)
    .not("listing_id", "is", null)
    // !inner + filtro no join: exclui matches cujo ativo ja foi pra Lixeira
    // (mesmo bug ja corrigido em Total Ativos e agora encontrado aqui tambem)
    .is("cm_asset_listings.deleted_at", null)
    .order("score", { ascending: false })
    .limit(50);

  if (status) query = query.eq("status", status);
  if (listingId) query = query.eq("listing_id", listingId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ matches: data ?? [] });
}
