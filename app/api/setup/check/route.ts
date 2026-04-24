import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

export async function GET() {
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const { data: buckets, error: bErr } = await svc.storage.listBuckets();
  const partnerDocs = buckets?.find((b) => b.id === "partner-docs");

  const { error: tErr } = await svc.from("partner_registrations").select("id").limit(1);

  return NextResponse.json({
    tabela: tErr ? `ERRO: ${tErr.message}` : "OK",
    bucket_partner_docs: partnerDocs ? "OK" : "NÃO ENCONTRADO",
    todos_buckets: buckets?.map((b) => b.id) ?? [],
  });
}
