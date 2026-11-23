import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { enterprisePorDominio } from "@/lib/enterprise";
import { cssVariaveis } from "@/lib/enterprise-tema";

// GET /api/public/white-label — marca (nome + logo) do Enterprise dono do domínio acessado,
// para a tela de login (sem sessão). Só devolve dados públicos da marca; null em domínio V3.
export async function GET(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const e = await enterprisePorDominio(db, host).catch(() => null);
  // Tema (BRIEF 2026-11-21): só dados públicos de marca. temaCss é gerado de cores já validadas (hex).
  return NextResponse.json({
    marca: e?.marca ?? null,
    temaCss: e?.tema ? cssVariaveis(e.tema) : null,
    iconeUrl: e?.tema?.icone_url ?? null,
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
