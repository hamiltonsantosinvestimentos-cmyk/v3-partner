import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { SQUADS } from "@/lib/squads";

interface Message { role: "user" | "assistant"; content: string; ts?: string; }

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    squad_id: string;
    message: string;
    session_id?: string;
    history?: Message[];
  };

  const { squad_id, message, session_id, history = [] } = body;

  const squad = SQUADS[squad_id];
  if (!squad) return NextResponse.json({ error: "Squad inválido" }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

  // Build messages for Claude
  const claudeMessages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: message },
  ];

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: squad.prompt,
      messages: claudeMessages,
    });

    const assistantText = response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");

    const now = new Date().toISOString();
    const newMessages: Message[] = [
      ...history,
      { role: "user", content: message, ts: now },
      { role: "assistant", content: assistantText, ts: now },
    ];

    const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    let finalSessionId = session_id;

    if (session_id) {
      // Update existing session
      await svc
        .from("agent_sessions")
        .update({ messages: newMessages, updated_at: now })
        .eq("id", session_id)
        .eq("user_id", user.id);
    } else {
      // Create new session — title = first 60 chars of user message
      const title = message.length > 60 ? message.substring(0, 60) + "…" : message;
      const { data: newSession } = await svc
        .from("agent_sessions")
        .insert({ user_id: user.id, squad_id, title, messages: newMessages })
        .select("id")
        .single();
      finalSessionId = newSession?.id;
    }

    return NextResponse.json({
      response: assistantText,
      session_id: finalSessionId,
      tokens_used: response.usage.output_tokens,
    });
  } catch (err) {
    console.error("[agentes/chat]", err);
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
