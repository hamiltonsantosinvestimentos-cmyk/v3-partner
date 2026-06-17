import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_CREATE = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const ALLOWED_ADMIN = ["ADMIN"];

// ── GET /api/governance/folders?vertical=MA&status=active ───────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";

  const url = new URL(req.url);
  const vertical = url.searchParams.get("vertical");
  const status = url.searchParams.get("status") || "active";
  const deal_code = url.searchParams.get("deal_code");

  let query = db
    .from("folder_registry")
    .select("id, vertical, deal_code, client_name, full_path, depth, status, created_at")
    .eq("status", status)
    .order("full_path");

  if (vertical) query = query.eq("vertical", vertical);
  if (deal_code) query = query.eq("deal_code", deal_code);

  if (!ALLOWED_ADMIN.includes(role)) {
    const { data: grants } = await db
      .from("folder_access_grants")
      .select("folder_id")
      .eq("user_id", user.id);

    const folderIds = (grants ?? []).map((g: { folder_id: string }) => g.folder_id);
    if (folderIds.length === 0) {
      return NextResponse.json({ folders: [] });
    }
    query = query.in("id", folderIds);
  }

  const { data: folders, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ folders: folders ?? [] });
}

// ── POST /api/governance/folders ────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  if (!ALLOWED_CREATE.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito a ADMIN, GESTAO e MESA_OPERACIONAL" }, { status: 403 });
  }

  const body = await req.json();
  const { vertical, deal_code, client_name } = body;

  if (!vertical || !deal_code || !client_name) {
    return NextResponse.json(
      { error: "vertical, deal_code e client_name são obrigatórios" },
      { status: 422 }
    );
  }

  const validVerticals = ["MA", "Credito", "Consorcios"];
  if (!validVerticals.includes(vertical)) {
    return NextResponse.json(
      { error: `Vertical inválida. Permitidas: ${validVerticals.join(", ")}` },
      { status: 422 }
    );
  }

  const patterns: Record<string, RegExp> = {
    MA: /^V3-\d{4}-(0[1-9]|1[0-2])-[A-Z]{3}-\d{3}$/,
    Credito: /^CRE-\d{4}-\d{3}$/,
    Consorcios: /^CON-\d{4}-\d{3}$/,
  };

  if (!patterns[vertical].test(deal_code)) {
    return NextResponse.json(
      { error: `deal_code "${deal_code}" não corresponde ao padrão da vertical ${vertical}` },
      { status: 422 }
    );
  }

  const { data: existing } = await db
    .from("folder_registry")
    .select("id")
    .eq("deal_code", deal_code)
    .eq("depth", 1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: `Pasta para deal ${deal_code} já existe`, folder_id: existing.id },
      { status: 409 }
    );
  }

  const { data: result, error } = await db.rpc("create_deal_folder", {
    p_vertical: vertical,
    p_deal_code: deal_code,
    p_client_name: client_name,
    p_user_id: user.id,
  });

  if (error) {
    if (error.message.includes("FOLDER_VIOLATION")) {
      await db.from("folder_governance_log").insert({
        event_type: "FOLDER_VIOLATION",
        user_id: user.id,
        user_name: profile?.full_name,
        target_path: `${vertical}/${deal_code}_${client_name}`,
        deal_code,
        vertical,
        severity: "critical",
        details: { reason: error.message },
      });
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: created } = await db
    .from("folder_registry")
    .select("id, full_path, vertical, deal_code, client_name, status")
    .eq("deal_code", deal_code)
    .eq("depth", 1)
    .single();

  const { data: subfolders } = await db
    .from("folder_registry")
    .select("full_path")
    .eq("deal_code", deal_code)
    .eq("depth", 2)
    .order("full_path");

  return NextResponse.json({
    folder_id: result,
    folder: created,
    subfolders_created: (subfolders ?? []).map((s: { full_path: string }) => s.full_path),
  }, { status: 201 });
}

// ── DELETE /api/governance/folders?folder_id=... ────────────────────────────────
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_ADMIN.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Somente ADMIN pode excluir pastas" }, { status: 403 });
  }

  const folder_id = new URL(req.url).searchParams.get("folder_id");
  if (!folder_id) {
    return NextResponse.json({ error: "folder_id obrigatório" }, { status: 400 });
  }

  const { data: folder } = await db
    .from("folder_registry")
    .select("id, full_path, deal_code, depth")
    .eq("id", folder_id)
    .single();

  if (!folder) {
    return NextResponse.json({ error: "Pasta não encontrada" }, { status: 404 });
  }

  if (folder.depth === 1) {
    await db.from("folder_access_grants")
      .delete()
      .in("folder_id",
        (await db.from("folder_registry").select("id").eq("deal_code", folder.deal_code)).data?.map((r: { id: string }) => r.id) ?? []
      );
    await db.from("folder_registry").delete().eq("deal_code", folder.deal_code);
  } else {
    await db.from("folder_registry").delete().eq("id", folder_id);
  }

  return NextResponse.json({ deleted: true, path: folder.full_path });
}
