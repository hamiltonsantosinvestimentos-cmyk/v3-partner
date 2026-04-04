import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url    = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !svcKey) {
    return NextResponse.json({ step: "env_missing", url: !!url, svc: !!svcKey });
  }

  const admin = createClient(url, svcKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data, error } = await admin.auth.admin.updateUserById(
    "87e35789-90d2-4995-b79b-05be11e9b7ac",
    { password: "V3Partners2026!" }
  );

  return NextResponse.json({
    ok: !error,
    error: error?.message ?? null,
    errorCode: (error as any)?.code ?? null,
    userId: data?.user?.id ?? null,
  });
}
