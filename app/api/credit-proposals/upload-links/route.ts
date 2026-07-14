import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 30;

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — gera link de upload de documentos para o cliente de uma proposta
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc()
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();

  const body = await req.json() as {
    proposal_id:  string;
    label?:       string;
    expires_days?: number;
    max_uses?:    number;
  };

  const { proposal_id, label, expires_days = 14, max_uses = 30 } = body;
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const { data: proposal } = await svc()
    .from("credit_desk_proposals")
    .select("id, code, client_name, partner_id")
    .eq("id", proposal_id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isMesa = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  const isOwner = proposal.partner_id === user.id;
  if (!isMesa && !isOwner) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expires_days);

  const { data: tokenRow, error } = await svc()
    .from("credit_upload_tokens")
    .insert({
      proposal_id,
      partner_id: proposal.partner_id,
      label:      label ?? proposal.client_name,
      expires_at: expiresAt.toISOString(),
      max_uses,
      created_by: user.id,
    })
    .select("id, token, expires_at")
    .single();

  if (error || !tokenRow) {
    return NextResponse.json({ error: "Erro ao criar token de upload" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
  const uploadUrl = `${baseUrl}/documentos/${tokenRow.token}`;

  return NextResponse.json({
    ok:            true,
    token:         tokenRow.token,
    upload_url:    uploadUrl,
    expires_at:    tokenRow.expires_at,
    proposal_code: proposal.code,
  });
}

// GET — lista tokens ativos de uma proposta
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();

  const { searchParams } = new URL(req.url);
  const proposal_id = searchParams.get("proposal_id");
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const { data: proposal } = await svc().from("credit_desk_proposals").select("partner_id").eq("id", proposal_id).single();
  if (!proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const isMesa = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  const isOwner = proposal.partner_id === user.id;
  if (!isMesa && !isOwner) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { data, error } = await svc()
    .from("credit_upload_tokens")
    .select("id, token, label, expires_at, used_count, max_uses, status, created_at")
    .eq("proposal_id", proposal_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
  const tokens = (data ?? []).map(t => ({
    ...t,
    upload_url: `${baseUrl}/documentos/${t.token}`,
  }));

  return NextResponse.json({ tokens });
}
