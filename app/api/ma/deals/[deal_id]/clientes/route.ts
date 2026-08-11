import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveClient } from "@/lib/v3-clients";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

type RouteContext = { params: Promise<{ deal_id: string }> };

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED.includes(profile.role as string)) return null;
  return { userId: user.id };
}

// GET — clientes vinculados a este deal (Client 360, Fase B), com dados do
// v3_clients já resolvidos (nome, tipo de documento).
export async function GET(req: NextRequest, ctx: RouteContext) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId } = await ctx.params;

  const { data, error } = await svc()
    .from("ma_deal_clients")
    .select("id, role, status, created_at, v3_clients(id, document_number, document_type, legal_name)")
    .eq("deal_id", dealId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clientes: data ?? [] });
}

// POST — vincula um cliente (por CPF/CNPJ) a este deal. Nasce como
// "prospecto", papel opcional (Mesa pode definir na hora ou depois via
// PATCH). resolveClient() nunca inventa vínculo a partir de documento
// inválido — retorna 422 nesse caso, igual ao resto do sistema.
export async function POST(req: NextRequest, ctx: RouteContext) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const { deal_id: dealId } = await ctx.params;

  const body = await req.json();
  const { cpf_cnpj, legal_name, role } = body as { cpf_cnpj?: string; legal_name?: string; role?: string };

  if (role && !["comprador", "vendedor", "intermediario"].includes(role)) {
    return NextResponse.json({ error: "Papel inválido: use comprador, vendedor ou intermediario" }, { status: 422 });
  }

  const db = svc();
  const v3ClientId = await resolveClient(cpf_cnpj, { legalName: legal_name ?? null, vertical: "ma", db });
  if (!v3ClientId) {
    return NextResponse.json({ error: "CPF/CNPJ inválido — confira o documento informado" }, { status: 422 });
  }

  const { data, error } = await db
    .from("ma_deal_clients")
    .insert({ deal_id: dealId, v3_client_id: v3ClientId, role: role ?? null, created_by: caller.userId })
    .select("id, role, status, created_at, v3_clients(id, document_number, document_type, legal_name)")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Este cliente já está vinculado a este deal" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cliente: data }, { status: 201 });
}
