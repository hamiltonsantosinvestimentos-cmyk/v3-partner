import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const JOAO_USER_ID = "d0af8eaa-9f3c-4e7a-b8c6-613736524317";

export async function POST(req: NextRequest) {
  const serviceToken = req.headers.get("x-v3-service-token");
  const validToken = process.env.V3_INGEST_SECRET;

  if (!serviceToken || serviceToken !== validToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, html, squad_id, type } = body as {
      title?: string;
      html?: string;
      squad_id?: string;
      type?: string;
    };

    if (!title || !html) {
      return NextResponse.json({ error: "title and html are required" }, { status: 400 });
    }

    const reportSquadId = squad_id || type || "meeting-intel";

    const { data, error } = await svc()
      .from("generated_reports")
      .insert({
        user_id: JOAO_USER_ID,
        squad_id: reportSquadId,
        title,
        html,
      })
      .select("id, created_at")
      .single();

    if (error) {
      console.error("[relatorios/ingest]", error);
      return NextResponse.json({ error: "Failed to insert report" }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id, created_at: data.created_at });
  } catch (e) {
    console.error("[relatorios/ingest]", e);
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
