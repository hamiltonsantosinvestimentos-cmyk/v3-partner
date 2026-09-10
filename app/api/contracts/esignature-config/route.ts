import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("full_name, role").eq("id", user.id).single();
  if (!profile || !ALLOWED.includes(profile.role as string)) return null;
  return { userId: user.id, name: profile.full_name ?? "Usuário" };
}

// GET/PATCH /api/contracts/esignature-config — Fase 3 do BRIEF "ClickSign vs
// CertOne" (10/09/2026): switch de provedor de assinatura digital POR
// VERTICAL (as 7 verticais reais de contract_vertical, corrigido do rascunho
// original do BRIEF que citava "Regularização" como se fosse vertical -- não
// é, é série de contrato). Trocar aqui NUNCA afeta contrato já enviado: o
// provedor real de cada contrato fica congelado em
// operation_contracts.esignature_provider no momento do envio (ver
// app/api/contracts/[id]/send), esta config só vale para envios futuros.
export async function GET(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data, error } = await svc()
    .from("esignature_vertical_config")
    .select("vertical, provider, updated_at")
    .order("vertical");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function PATCH(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { vertical, provider } = await req.json();
  if (!vertical || !["clicksign", "certone"].includes(provider)) {
    return NextResponse.json({ error: "vertical e provider ('clicksign'|'certone') são obrigatórios" }, { status: 422 });
  }

  const { data, error } = await svc()
    .from("esignature_vertical_config")
    .update({ provider, updated_by: caller.userId, updated_at: new Date().toISOString() })
    .eq("vertical", vertical)
    .select("vertical, provider, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
