import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function GET(req: NextRequest) {
  const caller = await requireRole(req);
  if (!caller) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const vertical = url.searchParams.get("vertical");
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("q");

  let query = svc()
    .from("operation_contracts")
    .select("*")
    .order("created_at", { ascending: false });

  if (vertical) query = query.eq("vertical", vertical);
  if (status) query = query.eq("status_signature", status);
  if (search) query = query.ilike("contract_title", `%${search}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const contractIds = (data ?? []).map((c: any) => c.id);

  let approvals: any[] = [];
  let notes: any[] = [];

  if (contractIds.length > 0) {
    const [appRes, notesRes] = await Promise.all([
      svc().from("contract_approvals").select("*").in("contract_id", contractIds).order("created_at", { ascending: true }),
      svc().from("contract_notes").select("*").in("contract_id", contractIds).order("created_at", { ascending: true }),
    ]);
    approvals = appRes.data ?? [];
    notes = notesRes.data ?? [];
  }

  const contracts = (data ?? []).map((c: any) => ({
    ...c,
    approvals: approvals.filter((a: any) => a.contract_id === c.id),
    notes: notes.filter((n: any) => n.contract_id === c.id),
  }));

  return NextResponse.json({ contracts });
}
