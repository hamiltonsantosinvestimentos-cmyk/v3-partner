import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// GET /api/contracts/html/[id]/[token] — serve o rendered_html de um
// contrato para consumo servidor-a-servidor pelo ClickSign (sendToClickSignV3
// busca esta URL via fetch simples). Rota pública gated por signing_token
// (não por sessão), mesmo padrão de app/api/cm/annex-sign/[token]. Path
// escolhido de propósito ("html" logo após /api/contracts/) para casar com
// prefixo simples em PUBLIC_ROUTES no proxy.ts, sem abrir todo /api/contracts/.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; token: string }> }) {
  const { id, token } = await params;

  const { data: contract } = await svc()
    .from("operation_contracts")
    .select("rendered_html, signing_token")
    .eq("id", id)
    .single();

  if (!contract || !contract.signing_token || contract.signing_token !== token) {
    return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
  }

  return new NextResponse(contract.rendered_html ?? "", { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
