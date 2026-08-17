import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// 14/08/2026: MESA_OPERACIONAL adicionado ao GET (listar templates), mesmo
// motivo do requireRole de app/api/contracts/generate/route.ts — analista
// de crédito de plantão precisa listar o template NCNDA pra gerar o
// contrato, não só ADMIN/GESTAO.
async function requireAdmin(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const vertical = new URL(req.url).searchParams.get("vertical");

  let query = svc()
    .from("contract_templates")
    .select("*")
    .eq("is_active", true)
    .order("vertical")
    .order("template_name");

  if (vertical) query = query.eq("vertical", vertical);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ templates: data ?? [] });
}

// Séries V3C válidas (lib/v3-codes.ts V3Series). contract_series é NOT NULL
// desde a migration 20260807b — POST nunca setava esse campo (achado real
// 11/08/2026, ao testar "Nova Minuta" pela UI: 500 "null value in column
// contract_series"). Toda minuta criada até hoje foi inserida via SQL direto,
// nunca por esta rota, por isso o bug nunca apareceu em produção antes.
const VALID_SERIES = ["V3C-ORG", "V3C-MAN", "V3C-PAR", "V3C-CES", "V3C-NDA", "V3C-LOI", "V3C-FPA", "V3C-FOR", "V3C-FUN"];

export async function POST(req: NextRequest) {
  const caller = await requireAdmin(req);
  if (!caller || caller.role !== "ADMIN")
    return NextResponse.json({ error: "Apenas ADMIN pode criar templates" }, { status: 403 });

  const { template_name, vertical, body_text_raw, variables_map, contract_series } = await req.json();

  if (!template_name || !vertical || !body_text_raw)
    return NextResponse.json({ error: "template_name, vertical e body_text_raw obrigatórios" }, { status: 422 });
  if (!contract_series || !VALID_SERIES.includes(contract_series))
    return NextResponse.json({ error: `contract_series obrigatório, um de: ${VALID_SERIES.join(", ")}` }, { status: 422 });

  const vars = (body_text_raw.match(/\{\{([^}]+)\}\}/g) || []).map((v: string) => v.replace(/\{\{|\}\}/g, "").trim());

  const { data, error } = await svc()
    .from("contract_templates")
    .insert({
      template_name,
      vertical,
      body_text_raw,
      contract_series,
      variables_map: variables_map ?? vars.map((v: string) => ({ key: v, label: v.replace(/_/g, " "), source: "auto" })),
      created_by: caller.userId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ template: data }, { status: 201 });
}
