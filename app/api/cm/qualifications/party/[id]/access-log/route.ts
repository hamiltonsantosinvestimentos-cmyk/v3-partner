import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { labelRevealField, maskIp } from "@/lib/qualification-mask";

// Lista de acessos a dados sensíveis de uma qualificação (BRIEF 5.12 C): quem revelou, qual campo,
// quando. IP sempre mascarado, sem ação de desmascarar. Somente leitura, mesmos papéis da ficha.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];
const PAGE_SIZE = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role as string)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const offset = Math.max(0, Number(new URL(req.url).searchParams.get("offset") ?? 0) || 0);

  const { data: rows, error } = await db
    .from("cm_party_qualification_field_views")
    .select("id, field, viewed_by, viewed_at, ip")
    .eq("qualification_id", id)
    .order("viewed_at", { ascending: false })
    .range(offset, offset + PAGE_SIZE); // um a mais para saber se há "ver mais"
  if (error) return NextResponse.json({ error: "Não foi possível carregar os acessos" }, { status: 500, headers: { "Cache-Control": "no-store" } });

  const page = (rows ?? []).slice(0, PAGE_SIZE);
  const userIds = [...new Set(page.map((r) => r.viewed_by).filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (userIds.length) {
    const { data: profiles } = await db.from("profiles").select("id, full_name").in("id", userIds);
    for (const p of profiles ?? []) names.set(p.id as string, (p.full_name as string) || "Usuário");
  }

  const items = page.map((r) => ({
    id: r.id,
    field_label: labelRevealField(r.field as string),
    viewed_at: r.viewed_at,
    viewed_by_name: r.viewed_by ? names.get(r.viewed_by as string) ?? "Usuário removido" : "Usuário removido",
    ip_masked: maskIp(r.ip as string | null),
  }));

  return NextResponse.json({ items, has_more: (rows ?? []).length > PAGE_SIZE }, { headers: { "Cache-Control": "no-store" } });
}
