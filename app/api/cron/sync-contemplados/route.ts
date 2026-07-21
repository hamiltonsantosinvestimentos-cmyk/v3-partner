import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { runSyncContemplados, SyncError } from "@/lib/consorcio/sync-contemplados";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const result = await runSyncContemplados(null);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof SyncError ? e.message : String(e);
    const status = e instanceof SyncError ? e.status : 500;

    await svc().from("execution_errors").insert({
      workflow: "cron/sync-contemplados",
      error_message: message,
      severity: "medium",
    });

    return NextResponse.json({ error: message }, { status });
  }
}
