import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { buscarProcessosEscavador } from "@/lib/escavador";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(supabaseUser: { id: string } | null) {
  if (!supabaseUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: profile } = await svc().from("profiles").select("role").eq("id", supabaseUser.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { userId: supabaseUser.id };
}

/** Historico de checagens ja feitas neste ativo, mais recente primeiro. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { id } = await params;

  const { data, error } = await svc()
    .from("cm_due_diligence_records")
    .select("id, tool, query_type, query_value, result, requested_by, created_at")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ records: data ?? [] });
}

/** Roda uma nova busca Escavador para o ativo e salva o resultado no historico. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { id } = await params;

  const { data: listing } = await svc()
    .from("cm_asset_listings")
    .select("id")
    .eq("id", id)
    .single();
  if (!listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  const token = process.env.ESCAVADOR_API_TOKEN;
  if (!token) return NextResponse.json({ error: "ESCAVADOR_API_TOKEN não configurado" }, { status: 500 });

  const body = await req.json();
  const { tipo, valor } = body as { tipo?: "cpf" | "cnpj" | "nome"; valor?: string };
  if (!tipo || !valor?.trim()) {
    return NextResponse.json({ error: "tipo e valor são obrigatórios" }, { status: 422 });
  }

  let result;
  try {
    result = await buscarProcessosEscavador(tipo, valor, token);
  } catch (err) {
    return NextResponse.json(
      { error: `Erro ao consultar Escavador: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const { data: record, error: insertError } = await svc()
    .from("cm_due_diligence_records")
    .insert({
      listing_id: id,
      tool: "escavador",
      query_type: tipo,
      query_value: valor.trim(),
      result,
      requested_by: auth.userId,
    })
    .select("id")
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  return NextResponse.json({ ...result, record_id: record.id });
}
