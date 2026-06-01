import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ALLOWED = ["ADMIN", "GESTAO", "MESA", "MESA_OPERACIONAL"];

// GET /api/ma/audio-intel/[intake_id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ intake_id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  if (!ALLOWED.includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Acesso restrito" }, { status: 403 });
  }

  const { intake_id } = await params;

  const { data: intake, error: intakeErr } = await db
    .from("deal_intakes")
    .select("id, audio_extraction_id, origem_audio, descricao_breve, setor, status, created_at")
    .eq("id", intake_id)
    .single();

  if (intakeErr || !intake) {
    return NextResponse.json({ error: "Intake não encontrado" }, { status: 404 });
  }

  if (!intake.audio_extraction_id) {
    return NextResponse.json({ error: "Intake sem extração de áudio" }, { status: 404 });
  }

  const { data: extraction, error: extErr } = await db
    .from("whatsapp_audio_extractions")
    .select(
      "id, transcription, vertical_detected, ticket_estimado, urgencia, resumo_executivo, proximo_passo, dados_contato:extraction_raw->dados_contato, status, sender_phone, sender_name, processed_at, created_at, error_message"
    )
    .eq("id", intake.audio_extraction_id)
    .single();

  if (extErr || !extraction) {
    return NextResponse.json({ error: "Extração não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ intake, extraction });
}
