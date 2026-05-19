import { NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(request: Request) {
  // Auth check
  let userId: string;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    userId = user.id;
  } catch {
    return NextResponse.json({ error: "Erro de autenticação" }, { status: 401 });
  }

  let body: {
    transcript: string;
    title?: string;
    participants?: string[];
    duration_minutes?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { transcript, title, participants, duration_minutes } = body;

  if (!transcript || typeof transcript !== "string") {
    return NextResponse.json({ error: "Transcrição é obrigatória" }, { status: 400 });
  }
  if (transcript.length < 100) {
    return NextResponse.json(
      { error: "Transcrição muito curta (mínimo 100 caracteres)" },
      { status: 400 }
    );
  }
  if (transcript.length > 50000) {
    return NextResponse.json(
      { error: "Transcrição muito longa (máximo 50.000 caracteres)" },
      { status: 400 }
    );
  }

  const meetingTitle = title?.trim() || "Reunião sem título";

  const prompt = `Você é um assistente especializado em reuniões de negócios financeiros.
Analise a transcrição abaixo e gere um resumo estruturado em português.

Transcrição: ${transcript}

Retorne um JSON com:
{
  "summary": "resumo executivo em 3-5 parágrafos",
  "action_items": ["ação 1", "ação 2"],
  "key_decisions": ["decisão 1"],
  "next_steps": "próximos passos em texto",
  "sentiment": "positivo | neutro | negativo"
}

Retorne APENAS o JSON, sem texto adicional.`;

  let aiResult: {
    summary: string;
    action_items: string[];
    key_decisions: string[];
    next_steps: string;
    sentiment: string;
  };

  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== "text") {
      throw new Error("Resposta inesperada da IA");
    }

    // Extract JSON from the response
    let jsonText = rawContent.text.trim();
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "");

    aiResult = JSON.parse(jsonText);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao chamar IA";
    return NextResponse.json({ error: `Falha ao gerar resumo: ${message}` }, { status: 500 });
  }

  // Save to database
  try {
    const svc = serviceClient();
    const { data, error } = await svc
      .from("meeting_summaries")
      .insert({
        user_id: userId,
        title: meetingTitle,
        transcript,
        summary: aiResult.summary,
        action_items: aiResult.action_items ?? [],
        participants: participants ?? [],
        duration_minutes: duration_minutes ?? null,
        meeting_date: new Date().toISOString().split("T")[0],
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Erro ao salvar reunião" }, { status: 500 });
    }

    return NextResponse.json({
      id: data.id,
      title: meetingTitle,
      summary: aiResult.summary,
      action_items: aiResult.action_items ?? [],
      key_decisions: aiResult.key_decisions ?? [],
      next_steps: aiResult.next_steps ?? "",
      sentiment: aiResult.sentiment ?? "neutro",
      meeting_date: data.meeting_date,
      created_at: data.created_at,
    });
  } catch {
    return NextResponse.json({ error: "Erro ao salvar no banco de dados" }, { status: 500 });
  }
}
