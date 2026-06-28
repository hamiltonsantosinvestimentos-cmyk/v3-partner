import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

const ALLOWED = ["ADMIN", "GESTAO", "MESA"];
const N8N_URL = process.env.N8N_URL ?? "https://n8n-514n.onrender.com";

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? ""))
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });

  const t0 = Date.now();

  try {
    const controller = new AbortController();
    // 9s — seguro para Vercel Hobby (limit 10s)
    const timer = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(`${N8N_URL}/healthz`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    const elapsed = Date.now() - t0;

    if (res.ok) {
      return NextResponse.json({ status: "online", elapsed_ms: elapsed });
    }
    return NextResponse.json(
      { status: "error", elapsed_ms: elapsed, message: `n8n HTTP ${res.status}` },
      { status: 502 }
    );
  } catch {
    const elapsed = Date.now() - t0;
    // AbortError = cold start — o ping JÁ foi enviado ao Render; servidor está acordando
    return NextResponse.json(
      { status: "warming", elapsed_ms: elapsed },
      { status: 202 }
    );
  }
}
