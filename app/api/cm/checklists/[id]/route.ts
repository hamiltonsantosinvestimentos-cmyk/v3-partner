import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function getCaller(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role, full_name").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string, name: profile.full_name as string };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await getCaller(req);
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN/GESTAO/MESA_OPERACIONAL" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();

  if (body.action === "check_item") {
    const { item_id, is_checked, evidence_url, notes } = body;
    if (!item_id) return NextResponse.json({ error: "item_id obrigatório" }, { status: 422 });

    const update: Record<string, any> = {
      is_checked: is_checked ?? true,
      checked_by: is_checked !== false ? caller.userId : null,
      checked_at: is_checked !== false ? new Date().toISOString() : null,
    };
    if (evidence_url !== undefined) update.evidence_url = evidence_url;
    if (notes !== undefined) update.notes = notes;

    const { error } = await svc()
      .from("cm_checklist_items")
      .update(update)
      .eq("id", item_id)
      .eq("checklist_id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data: items } = await svc()
      .from("cm_checklist_items")
      .select("is_checked")
      .eq("checklist_id", id);

    const allChecked = items?.every((i: any) => i.is_checked);
    const anyChecked = items?.some((i: any) => i.is_checked);

    const newStatus = allChecked ? "concluido" : anyChecked ? "em_andamento" : "pendente";
    await svc().from("cm_operation_checklists").update({
      status: newStatus,
      completed_at: allChecked ? new Date().toISOString() : null,
      completed_by: allChecked ? caller.userId : null,
    }).eq("id", id);

    const { data: checklist } = await svc()
      .from("cm_operation_checklists")
      .select("*, cm_checklist_items(*)")
      .eq("id", id)
      .single();

    return NextResponse.json({ checklist });
  }

  return NextResponse.json({ error: "action inválida" }, { status: 422 });
}
