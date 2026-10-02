import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { fetchAuditPage, fetchSummary, parseCursor, parseFilters } from "@/lib/access-audit";

// Auditoria de acessos a dado sensível. SÓ ADMIN (403 para os demais, sem confirmar que a tela existe).
const NO_STORE = { "Cache-Control": "no-store" };
const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401, headers: NO_STORE });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "ADMIN") return NextResponse.json({ error: "Não autorizado" }, { status: 403, headers: NO_STORE });

  const sp = new URL(req.url).searchParams;
  const parsed = parseFilters(sp);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 422, headers: NO_STORE });
  const cursor = parseCursor(sp.get("cursor"));

  try {
    const [page, summary] = await Promise.all([
      fetchAuditPage(db, parsed.f, parsed.fromIso, parsed.toIso, cursor, 50),
      cursor ? Promise.resolve(null) : fetchSummary(db), // resumo só na primeira página
    ]);
    return NextResponse.json({ ...page, summary }, { headers: NO_STORE });
  } catch (e) {
    console.error("[access-audit] falha", (e as Error).message);
    return NextResponse.json({ error: "Não foi possível carregar a auditoria" }, { status: 500, headers: NO_STORE });
  }
}
