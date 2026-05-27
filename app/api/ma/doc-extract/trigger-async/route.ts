import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const WRITE_ROLES = ["ADMIN", "GESTAO"] as const;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// POST — re-dispara o n8n W9 para uma extração presa em status "queued"
// Uso: retry manual por ADMIN/GESTAO quando o webhook falhou
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = serviceClient();
  const { data: profile } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!WRITE_ROLES.includes(profile?.role as typeof WRITE_ROLES[number])) {
    return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem re-disparar extrações" }, { status: 403 });
  }

  const body = await req.json() as { extraction_id: string };
  const { extraction_id } = body;
  if (!extraction_id) return NextResponse.json({ error: "extraction_id obrigatório" }, { status: 400 });

  const { data: extraction, error } = await svc
    .from("ma_document_extractions")
    .select("id, deal_id, doc_id, storage_path, status")
    .eq("id", extraction_id)
    .single();

  if (error || !extraction) {
    return NextResponse.json({ error: "Extração não encontrada" }, { status: 404 });
  }

  if (!["queued", "error"].includes(extraction.status as string)) {
    return NextResponse.json({ error: `Extração com status "${extraction.status}" não pode ser re-disparada` }, { status: 409 });
  }

  await svc.from("ma_document_extractions")
    .update({ status: "queued", error_message: null })
    .eq("id", extraction_id);

  const n8nUrl = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (n8nUrl) {
    fetch(`${n8nUrl}/webhook/v3-doc-extract-large`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        deal_id:       extraction.deal_id,
        doc_id:        extraction.doc_id,
        extraction_id: extraction.id,
        storage_path:  extraction.storage_path,
      }),
    }).catch(console.error);
  }

  return NextResponse.json({ ok: true, status: "queued" });
}
