import { NextResponse } from "next/server";

export async function GET() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return NextResponse.json({
    url_set:      !!url,
    url_prefix:   url?.slice(0, 40) ?? "MISSING",
    anon_set:     !!anonKey,
    anon_prefix:  anonKey?.slice(0, 20) ?? "MISSING",
    svc_set:      !!svcKey,
  });
}
