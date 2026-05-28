import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
  }

  // Busca QR code diretamente da Evolution API
  try {
    const res = await fetch(
      `${process.env.EVOLUTION_API_URL}/instance/connect/v3-sdr-whatsapp`,
      { headers: { apikey: process.env.EVOLUTION_API_KEY! } }
    );
    const data = await res.json() as { base64?: string; count?: number; code?: string };

    if (data.base64) {
      return NextResponse.json({ qrcode: data.base64, status: "pending" });
    }

    // Verifica estado da conexão
    const stateRes = await fetch(
      `${process.env.EVOLUTION_API_URL}/instance/connectionState/v3-sdr-whatsapp`,
      { headers: { apikey: process.env.EVOLUTION_API_KEY! } }
    );
    const stateData = await stateRes.json() as { instance?: { state?: string } };
    const state = stateData.instance?.state;

    if (state === "open") {
      return NextResponse.json({ qrcode: null, status: "connected" });
    }

    return NextResponse.json({ qrcode: null, status: state ?? "disconnected" });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
