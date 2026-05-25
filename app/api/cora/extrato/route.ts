import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { coraFetch } from "@/lib/cora";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "FINANCEIRO"].includes((profile as { role: string } | null)?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start"); // "YYYY-MM-DD"
  const end = searchParams.get("end");     // "YYYY-MM-DD"
  const page = searchParams.get("page") ?? "0";

  let path = `/v2/statements?page=${page}&limit=50`;
  if (start) path += `&start_date=${start}`;
  if (end) path += `&end_date=${end}`;

  try {
    const res = await coraFetch(path);
    const data = await res.json() as { message?: string };
    if (!res.ok) return NextResponse.json({ error: data?.message ?? "Erro Cora" }, { status: res.status });
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
