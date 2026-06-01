import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED_REPROCESS = ["ADMIN", "GESTAO"];

// POST /api/ma/audio-intel/reprocess
// Body: { intake_id: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED_REPROCESS.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Permissão insuficiente — apenas ADMIN e GESTAO" }, { status: 403 });
  }

  const { intake_id } = await req.json();
  if (!intake_id) return NextResponse.json({ error: "intake_id obrigatório" }, { status: 422 });

  const { data: intake, error: intakeErr } = await db
    .from("deal_intakes")
    .select("audio_extraction_id, origem_audio")
    .eq("id", intake_id)
    .single();

  if (intakeErr || !intake?.audio_extraction_id) {
    return NextResponse.json({ error: "Intake não encontrado ou sem extração de áudio" }, { status: 404 });
  }

  // Resetar extraction para 'pending' antes de disparar W12
  await db
    .from("whatsapp_audio_extractions")
    .update({ status: "pending", error_message: null, processed_at: null })
    .eq("id", intake.audio_extraction_id);

  // Disparar W12 via webhook interno (n8n Render)
  // W12 detecta o extraction_id e reprocessa sem precisar do áudio original
  const w12Url = `${process.env.N8N_BASE_URL || "https://n8n-514n.onrender.com"}/webhook/v3-whatsapp-audio-reprocess`;

  try {
    const res = await fetch(w12Url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ extraction_id: intake.audio_extraction_id }),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "W12 não respondeu", status: res.status },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Falha ao contatar n8n" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, extraction_id: intake.audio_extraction_id });
}
