import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { SQUADS } from "@/lib/squads";
import type Anthropic from "@anthropic-ai/sdk";

interface Message { role: "user" | "assistant"; content: string; ts?: string; }

// ── Web search backend (zero cost) ─────────────────────────────────────────
// Tenta Exa → Serper → DuckDuckGo (fallback gratuito)
async function webSearch(query: string): Promise<string> {
  // 1. Exa (se configurado)
  const exaKey = process.env.EXA_API_KEY?.trim();
  if (exaKey) {
    try {
      const res = await fetch("https://api.exa.ai/search", {
        method: "POST",
        headers: { "x-api-key": exaKey, "Content-Type": "application/json" },
        body: JSON.stringify({ query, numResults: 5, useAutoprompt: true, type: "neural" }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results ?? [])
          .map((r: { title: string; url: string; text?: string }) =>
            `[${r.title}](${r.url})\n${r.text?.substring(0, 300) ?? ""}`)
          .join("\n\n");
      }
    } catch { /* fallthrough */ }
  }

  // 2. Serper (se configurado)
  const serperKey = process.env.SERPER_API_KEY?.trim();
  if (serperKey) {
    try {
      const res = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
        body: JSON.stringify({ q: query, num: 5, hl: "pt", gl: "br" }),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.organic ?? [])
          .map((r: { title: string; link: string; snippet: string }) =>
            `[${r.title}](${r.link})\n${r.snippet}`)
          .join("\n\n");
      }
    } catch { /* fallthrough */ }
  }

  // 3. DuckDuckGo Instant Answer — gratuito, sem API key
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, { headers: { "User-Agent": "V3Partners-MarketScout/1.0" } });
    if (res.ok) {
      const data = await res.json();
      const results: string[] = [];
      if (data.AbstractText) results.push(data.AbstractText);
      if (data.RelatedTopics?.length) {
        data.RelatedTopics.slice(0, 5).forEach((t: { Text?: string; FirstURL?: string }) => {
          if (t.Text) results.push(`• ${t.Text}${t.FirstURL ? ` — ${t.FirstURL}` : ""}`);
        });
      }
      return results.join("\n") || `Nenhum resultado encontrado para: ${query}`;
    }
  } catch { /* fallthrough */ }

  return `Busca indisponível para: ${query}. Responda com base no seu conhecimento.`;
}

// ── Tool use loop para squads com useWebSearch: true ────────────────────────
async function runWithTools(
  anthropic: InstanceType<typeof import("@anthropic-ai/sdk").default>,
  system: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  maxIterations = 10
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const tools: Anthropic.Messages.Tool[] = [{
    name: "web_search",
    description: "Busca informações atuais na web sobre empresas, mandatários, preços, players de mercado e oportunidades de negócios.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Termo de busca preciso em português ou inglês" },
      },
      required: ["query"],
    },
  }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentMessages: any[] = [...messages];
  let iteration = 0;
  const SYNTHESIS_THRESHOLD = 6; // após 6 buscas, força síntese

  while (iteration < maxIterations) {
    // Após SYNTHESIS_THRESHOLD iterações, injeta instrução de síntese e remove tools
    const shouldSynthesize = iteration >= SYNTHESIS_THRESHOLD;
    const activeTools = shouldSynthesize ? undefined : tools;

    if (shouldSynthesize && iteration === SYNTHESIS_THRESHOLD) {
      currentMessages.push({
        role: "user",
        content: "Você já coletou informações suficientes. Com base em tudo que pesquisou até agora, entregue a resposta completa e estruturada no formato solicitado. Não faça mais buscas — sintetize agora."
      });
    }

    // QW-4: cache_control no system prompt — reduz ~80% custo em sessões longas
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: currentMessages,
      ...(activeTools ? { tools: activeTools } : {}),
    });

    if (response.stop_reason === "end_turn" || shouldSynthesize) {
      return response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("");
    }

    if (response.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: response.content });

      const toolResults = await Promise.all(
        response.content
          .filter(b => b.type === "tool_use")
          .map(async (b) => {
            const tool = b as { type: "tool_use"; id: string; name: string; input: { query: string } };
            const result = await webSearch(tool.input.query);
            return {
              type: "tool_result" as const,
              tool_use_id: tool.id,
              content: result,
            };
          })
      );

      currentMessages.push({ role: "user", content: toolResults });
      iteration++;
      continue;
    }

    // Fallback — retorna o que tiver
    return response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");
  }

  // Última tentativa — força resposta sem tools
  const finalResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [...currentMessages, { role: "user", content: "Sintetize suas pesquisas e entregue a resposta estruturada agora." }],
  });
  return finalResponse.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("") || "Não foi possível completar a pesquisa. Tente uma consulta mais específica.";
}

// ── Handler principal ────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    squad_id: string;
    message: string;
    session_id?: string;
    workspace_id?: string;
    workspace_context?: string;
    // QW-6: history removido do contrato do cliente — carregado do banco server-side
  };

  const { squad_id, message, session_id, workspace_id, workspace_context } = body;

  const squad = SQUADS[squad_id];
  if (!squad) return NextResponse.json({ error: "Squad inválido" }, { status: 400 });
  if (!message?.trim()) return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return NextResponse.json({ error: "API key não configurada" }, { status: 500 });

  // Inicializa service client antes do Claude — necessário para buscar histórico
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // QW-6: carrega histórico do banco (nunca do cliente — previne prompt injection via history)
  let dbHistory: Message[] = [];
  if (session_id) {
    const { data: existingSession } = await svc
      .from("agent_sessions")
      .select("messages")
      .eq("id", session_id)
      .eq("user_id", user.id)
      .single();
    dbHistory = (existingSession?.messages as Message[]) ?? [];
  }

  // Injeta contexto do workspace no system prompt se disponível
  const systemPrompt = workspace_context
    ? `${squad.prompt}\n\n---\nCONTEXTO DO DEAL WORKSPACE:\n${workspace_context}\n\nUse este contexto como base para suas análises. As informações acima foram coletadas por outros squads sobre este mesmo deal.`
    : squad.prompt;

  const claudeMessages = [
    ...dbHistory.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: message },
  ];

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const anthropic = new Anthropic({ apiKey });

    let assistantText: string;

    if (squad.useWebSearch) {
      // Market Scout — com tool_use de busca
      assistantText = await runWithTools(anthropic, systemPrompt, claudeMessages);
    } else {
      // Squads padrão — QW-4: cache_control no system prompt
      const maxTokens = squad.maxTokens ?? 4096;
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: maxTokens,
        system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
        messages: claudeMessages,
      });
      assistantText = response.content
        .filter(b => b.type === "text")
        .map(b => (b as { type: "text"; text: string }).text)
        .join("");
    }

    const now = new Date().toISOString();
    const newMessages: Message[] = [
      ...dbHistory,
      { role: "user", content: message, ts: now },
      { role: "assistant", content: assistantText, ts: now },
    ];

    let finalSessionId = session_id;

    if (session_id) {
      await svc.from("agent_sessions")
        .update({ messages: newMessages, updated_at: now })
        .eq("id", session_id).eq("user_id", user.id);
    } else {
      const title = message.length > 60 ? message.substring(0, 60) + "…" : message;
      const { data: newSession } = await svc.from("agent_sessions")
        .insert({
          user_id: user.id,
          squad_id,
          title,
          messages: newMessages,
          ...(workspace_id ? { workspace_id } : {}),
        })
        .select("id").single();
      finalSessionId = newSession?.id;
    }

    // Atualiza updated_at do workspace para refletir atividade recente
    if (workspace_id) {
      await svc.from("deal_workspaces")
        .update({ updated_at: now })
        .eq("id", workspace_id);
    }

    return NextResponse.json({ response: assistantText, session_id: finalSessionId });
  } catch (err) {
    console.error("[agentes/chat]", err);
    // MED-02: não vazar detalhes internos de erro para o cliente
    return NextResponse.json({ error: "Erro interno no processamento" }, { status: 500 });
  }
}
