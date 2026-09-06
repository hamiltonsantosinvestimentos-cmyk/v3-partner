import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { getOrCreateDealUploadToken, buildUploadUrl } from "@/lib/ma/upload-link";

export const maxDuration = 30;

const ADMIN_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — gera link de upload para um deal
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  if (!ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json() as {
    deal_id:    string;
    label?:     string;     // ex: "Contador João Silva"
    expires_days?: number;  // padrão: 14
    max_uses?:  number;     // padrão: 20
  };

  const { deal_id, label, expires_days = 14, max_uses = 20 } = body;
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  // Verifica se o deal existe
  const { data: deal } = await svc()
    .from("ma_deals")
    .select("id, code, v3_code")
    .eq("id", deal_id)
    .single();

  if (!deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  // 06/09/2026 (BRIEF Link de Captacao pos-NCNDA): reaproveita token ativo e
  // nao expirado existente para o mesmo deal em vez de criar um novo a cada
  // clique, mesmo padrao de dedupe ja usado em /api/cm/intake/generate e
  // /api/credit-engine/intake/generate.
  const result = await getOrCreateDealUploadToken(svc(), deal_id, user.id, { label, expiresDays: expires_days, maxUses: max_uses });
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok:         true,
    token:      result.token,
    upload_url: buildUploadUrl(result.token),
    expires_at: result.expires_at,
    deal_code:  deal.v3_code ?? deal.code,
    reused:     result.reused,
  });
}

// GET — lista tokens ativos de um deal
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deal_id = searchParams.get("deal_id");
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const { data, error } = await svc()
    .from("deal_upload_tokens")
    .select("id, token, label, expires_at, used_count, max_uses, status, created_at")
    .eq("deal_id", deal_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const tokens = (data ?? []).map(t => ({
    ...t,
    upload_url: buildUploadUrl(t.token as string),
  }));

  return NextResponse.json({ tokens });
}
