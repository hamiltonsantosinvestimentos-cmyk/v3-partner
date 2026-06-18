import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const BUCKET = "v3-docs-publico";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role ?? "";
  const isAdmin = role === "ADMIN";

  const url = new URL(req.url);
  const folderPath = url.searchParams.get("path") ?? "";

  if (!isAdmin) {
    const { data: grants } = await db
      .from("folder_access_grants")
      .select("folder_id, folder:folder_registry!folder_id(full_path)")
      .eq("user_id", user.id);

    const grantedPaths = (grants ?? []).map((g: Record<string, unknown>) => {
      const folder = g.folder as { full_path: string } | null;
      return folder?.full_path ?? "";
    }).filter(Boolean);

    const hasAccess = grantedPaths.some(p => folderPath.startsWith(p) || p.startsWith(folderPath));
    if (!hasAccess && folderPath) {
      return NextResponse.json({ error: "Sem acesso a esta pasta" }, { status: 403 });
    }
  }

  const { data: items, error } = await db.storage.from(BUCKET).list(folderPath, {
    limit: 500,
    sortBy: { column: "name", order: "asc" },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const files = (items ?? []).map(item => {
    const raw = item as unknown as Record<string, unknown>;
    const meta = raw.metadata as Record<string, unknown> | undefined;
    return {
      name: item.name,
      is_folder: item.id === null,
      size: meta?.size ?? 0,
      mime_type: meta?.mimetype ?? "",
      created_at: (raw.created_at as string) ?? null,
      updated_at: (raw.updated_at as string) ?? null,
      path: folderPath ? `${folderPath}/${item.name}` : item.name,
    };
  });

  return NextResponse.json({ path: folderPath || "/", files });
}
