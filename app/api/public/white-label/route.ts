import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { enterprisePorDominio } from "@/lib/enterprise";

// GET /api/public/white-label — marca (nome + logo) do Enterprise dono do domínio acessado,
// para a tela de login (sem sessão). Só devolve dados públicos da marca; null em domínio V3.
export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const e = await enterprisePorDominio(db, host).catch(() => null);
  return NextResponse.json({ marca: e?.marca ?? null }, { headers: { "Cache-Control": "public, max-age=300" } });
}
