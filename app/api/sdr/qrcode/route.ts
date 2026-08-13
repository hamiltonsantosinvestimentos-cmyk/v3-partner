import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionStatus, getSessionQr } from "@/lib/whatsapp/openwa-client";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  try {
    const session = await getSessionStatus();

    if (session.status === "ready") {
      return NextResponse.json({ qrcode: null, status: "connected", phone: session.phone, pushName: session.pushName });
    }

    if (session.status === "qr_ready") {
      const qrcode = await getSessionQr();
      return NextResponse.json({ qrcode, status: "pending" });
    }

    return NextResponse.json({ qrcode: null, status: session.status, error: session.lastError });
  } catch (e) {
    return NextResponse.json({ qrcode: null, status: "disconnected", error: String(e) });
  }
}
