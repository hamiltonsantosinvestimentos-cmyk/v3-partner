import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { familiaDoTemplate } from "@/lib/contrato-parceria-partner";

// GET /api/cadastro-partner/contrato?registration_id=… — Contratos de Parceria
// já gerados para o cadastro (botão "Enviar contrato" de /admin-cadastros).
// O contrato em si mora em operation_contracts (Central de Contratos); o
// vínculo com o cadastro é o e-mail do licenciado nas partes do contrato,
// que sempre sai do próprio cadastro (lib/contrato-parceria-partner.ts).

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("registration_id");
  if (!id) return NextResponse.json({ error: "registration_id obrigatório" }, { status: 400 });

  const { data: reg } = await db.from("partner_registrations").select("email").eq("id", id).maybeSingle();
  if (!reg?.email) return NextResponse.json({ contratos: [] });

  const { data: templates } = await db.from("contract_templates").select("id, template_name").eq("contract_series", "V3C-PAR");
  const templateIds = (templates ?? []).filter((t) => familiaDoTemplate(t.template_name) !== null).map((t) => t.id);
  if (templateIds.length === 0) return NextResponse.json({ contratos: [] });

  const { data, error } = await db
    .from("operation_contracts")
    .select("id, contract_code, status_signature, created_at, sent_to_signature_at, signed_at")
    .in("template_id", templateIds)
    .contains("parties", [{ email: reg.email }])
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ contratos: data ?? [] });
}
