import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Lê QR e estado do Supabase (persistido pelo webhook)
  const { data: rows } = await svc
    .from("sdr_config")
    .select("key, value, updated_at")
    .in("key", ["qrcode", "connection_state"]);

  const qrRow = rows?.find(r => r.key === "qrcode");
  const stateRow = rows?.find(r => r.key === "connection_state");
  const state = stateRow?.value ?? "disconnected";

  if (state === "open") {
    return NextResponse.json({ qrcode: null, status: "connected" });
  }

  // QR válido por 60s
  if (qrRow?.value && qrRow.updated_at) {
    const age = Date.now() - new Date(qrRow.updated_at).getTime();
    if (age < 60000) {
      return NextResponse.json({ qrcode: qrRow.value, status: "pending" });
    }
  }

  // Fallback: busca direto da Evolution API
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/instance/connect/v3-sdr-whatsapp`,
      { headers: { apikey: process.env.EVOLUTION_API_KEY! } }
    );
    const data = await res.json() as { base64?: string; count?: number };
    if (data.base64) {
      return NextResponse.json({ qrcode: data.base64, status: "pending" });
    }
  } catch { /* ignore */ }

  return NextResponse.json({ qrcode: null, status: state });
}
