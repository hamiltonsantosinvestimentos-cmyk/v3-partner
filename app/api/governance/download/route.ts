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
  const isAdmin = profile?.role === "ADMIN";

  const filePath = new URL(req.url).searchParams.get("path");
  if (!filePath) return NextResponse.json({ error: "path obrigatório" }, { status: 400 });

  if (!isAdmin) {
    const { data: grants } = await db
      .from("folder_access_grants")
      .select("folder_id, folder:folder_registry!folder_id(full_path)")
      .eq("user_id", user.id);

    const grantedPaths = (grants ?? []).map((g: Record<string, unknown>) => {
      const folder = g.folder as { full_path: string } | null;
      return folder?.full_path ?? "";
    }).filter(Boolean);

    const hasAccess = grantedPaths.some(p => filePath.startsWith(p));
    if (!hasAccess) {
      return NextResponse.json({ error: "Sem acesso a este arquivo" }, { status: 403 });
    }
  }

  const { data, error } = await db.storage.from(BUCKET).createSignedUrl(filePath, 300);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: error?.message ?? "Erro ao gerar URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl, expires_in: 300 });
}
