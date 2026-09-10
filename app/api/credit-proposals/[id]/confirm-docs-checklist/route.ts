import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

type RouteContext = { params: Promise<{ id: string }> };

// POST — a Mesa Operacional confirma que os documentos / checklist da proposta
// foram conferidos e estão OK. Grava data/hora e autor em metadata. Com
// { undo: true } desfaz a confirmação (mesmo gate de role).
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { id: proposalId } = await ctx.params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  const isAdmin = ADMIN_ROLES.includes(profile?.role as typeof ADMIN_ROLES[number]);
  if (!isAdmin) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as { undo?: boolean };

  const { data: proposal, error: propErr } = await db
    .from("credit_desk_proposals")
    .select("id, metadata")
    .eq("id", proposalId)
    .single();
  if (propErr || !proposal) return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });

  const meta = ((proposal.metadata as Record<string, unknown>) ?? {});
  const nextMeta = body.undo
    ? {
        ...meta,
        docs_checklist_confirmed_at: null,
        docs_checklist_confirmed_by: null,
        docs_checklist_confirmed_by_name: null,
      }
    : {
        ...meta,
        docs_checklist_confirmed_at: new Date().toISOString(),
        docs_checklist_confirmed_by: user.id,
        docs_checklist_confirmed_by_name: profile?.full_name ?? "Mesa Operacional",
      };

  const { data: updated, error: updErr } = await db
    .from("credit_desk_proposals")
    .update({ metadata: nextMeta, updated_at: new Date().toISOString() })
    .eq("id", proposalId)
    .select("id, metadata")
    .single();

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, proposal: updated });
}
