import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "PARTNER", "PARTNER_PRO", "MESA_OPERACIONAL"];

// GET — lista links do partner autenticado
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ROLES.includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const db = svc();
  const isAdmin = ["ADMIN", "GESTAO"].includes((profile as { role: string }).role);

  const query = db
    .from("partner_service_links")
    .select(`
      id, token, title, service_type, description, price_cents,
      active, total_uses, total_paid_cents, created_at,
      credit_desk_proposal_id, ma_deal_id,
      credit_desk_proposals(code, client_name),
      ma_deals(code, target_company, title),
      partner_service_orders(count)
    `)
    .order("created_at", { ascending: false });

  if (!isAdmin) query.eq("partner_id", user.id);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ links: data ?? [] });
}

// POST — cria novo link de serviço
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role, full_name").eq("id", user.id).single();
  const p = profile as { role: string; full_name: string } | null;
  if (!ALLOWED_ROLES.includes(p?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const body = await req.json() as {
    title?: string;
    service_type?: string;
    description?: string;
    price_cents?: number;
    deal_type?: "credit" | "ma" | null;
    deal_id?: string | null;
  };

  if (!body.title?.trim()) return NextResponse.json({ error: "Título obrigatório" }, { status: 400 });

  const VALID_TYPES = ["credit_analysis", "ma_intake", "due_diligence", "captacao"];
  if (!VALID_TYPES.includes(body.service_type ?? "")) {
    return NextResponse.json({ error: "Tipo de serviço inválido" }, { status: 400 });
  }

  const db = svc();
  const isAdmin = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(p?.role ?? "");

  // Vínculo a Deal (09/09/2026) — opcional, só faz sentido pra Análise de
  // Crédito. Confirma que o deal existe e pertence a quem está criando o
  // link (ADMIN/GESTAO/MESA_OPERACIONAL podem vincular em nome de qualquer
  // partner) antes de gravar — nunca confia no id que o client mandou sem
  // checar posse, mesmo padrão de authorization check do resto do projeto.
  let creditDeskProposalId: string | null = null;
  let maDealId: string | null = null;
  if (body.deal_type && body.deal_id) {
    if (body.deal_type === "credit") {
      const q = db.from("credit_desk_proposals").select("id, partner_id").eq("id", body.deal_id).single();
      const { data: prop } = await q;
      if (!prop || (!isAdmin && prop.partner_id !== user.id)) {
        return NextResponse.json({ error: "Proposta de Crédito não encontrada ou não pertence a você" }, { status: 404 });
      }
      creditDeskProposalId = prop.id;
    } else if (body.deal_type === "ma") {
      const { data: deal } = await db.from("ma_deals").select("id, created_by").eq("id", body.deal_id).is("deleted_at", null).single();
      if (!deal || (!isAdmin && deal.created_by !== user.id)) {
        return NextResponse.json({ error: "Deal de M&A não encontrado ou não pertence a você" }, { status: 404 });
      }
      maDealId = deal.id;
    }
  }

  const token = randomBytes(20).toString("hex");

  const { data, error } = await db
    .from("partner_service_links")
    .insert({
      partner_id:   user.id,
      token,
      title:        body.title.trim(),
      service_type: body.service_type,
      description:  body.description?.trim() ?? null,
      price_cents:  Math.max(0, Math.round(body.price_cents ?? 0)),
      active:       true,
      credit_desk_proposal_id: creditDeskProposalId,
      ma_deal_id:   maDealId,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, link: data });
}

// PATCH — ativa/desativa link
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await req.json() as { id?: string; active?: boolean };
  if (!body.id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

  const db = svc();
  const { error } = await db
    .from("partner_service_links")
    .update({ active: body.active })
    .eq("id", body.id)
    .eq("partner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
