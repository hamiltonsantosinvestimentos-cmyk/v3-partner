import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import type Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const ALLOWED_ROLES = ["ADMIN", "GESTAO"];

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function authorize(supabaseUser: { id: string } | null) {
  if (!supabaseUser) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };
  const { data: profile } = await svc().from("profiles").select("role").eq("id", supabaseUser.id).single();
  if (!ALLOWED_ROLES.includes(profile?.role ?? "")) {
    return { error: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { userId: supabaseUser.id };
}

// Mesmo cascata Exa → Serper → DuckDuckGo já em produção em app/api/agentes/chat/route.ts.
async function webSearch(query: string): Promise<string> {
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
          .map((r: { title: string; url: string; text?: string }) => `[${r.title}](${r.url})\n${r.text?.substring(0, 300) ?? ""}`)
          .join("\n\n");
      }
    } catch { /* fallthrough */ }
  }

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
          .map((r: { title: string; link: string; snippet: string }) => `[${r.title}](${r.link})\n${r.snippet}`)
          .join("\n\n");
      }
    } catch { /* fallthrough */ }
  }

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (res.ok) {
      const text = await res.text();
      const matches = [...text.matchAll(/result__a[^>]*href="([^"]+)"[^>]*>([^<]+)</g)].slice(0, 5);
      if (matches.length > 0) {
        return matches.map((m) => `[${m[2]}](${m[1]})`).join("\n");
      }
    }
  } catch { /* fallthrough */ }

  return `Busca indisponível para: ${query}.`;
}

const SYSTEM_PROMPT = `Você está apoiando a Mesa M&A da V3 Partners numa due diligence inicial de compliance
sobre um possível investidor. Use a ferramenta de busca para localizar o perfil de LinkedIn
e outras redes sociais públicas associadas ao nome informado. Nunca invente URL ou dado:
cite só o que a busca realmente retornou. Se não achar nada com confiança razoável, diga
isso explicitamente. Responda em português, em até 8 linhas.

Formato de saída obrigatório: texto corrido em PARÁGRAFOS, sem nenhuma sintaxe Markdown
(nunca usar #, ##, **, tabelas em | |, ou listas com - ou *). O resultado vai direto para
um PDF institucional que renderiza o texto puro, então qualquer marcação aparece como
símbolo cru na página. Se precisar listar mais de um perfil, separe por ponto e vírgula
dentro do próprio parágrafo (ex: "LinkedIn: url1; outro perfil: url2").`;

async function runSocialSearch(entityName: string): Promise<{ text: string; sources: string[] }> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const tools: Anthropic.Messages.Tool[] = [
    {
      name: "web_search",
      description: "Busca perfis públicos de LinkedIn e outras redes sociais associadas a um nome.",
      input_schema: {
        type: "object" as const,
        properties: { query: { type: "string", description: "Termo de busca, ex: nome + LinkedIn" } },
        required: ["query"],
      },
    },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let messages: any[] = [
    { role: "user", content: `Encontre o perfil público de LinkedIn e redes sociais de: "${entityName}".` },
  ];
  const foundUrls = new Set<string>();

  for (let iteration = 0; iteration < 3; iteration++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages,
      tools,
    });

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });
      const toolResults = await Promise.all(
        response.content
          .filter((b) => b.type === "tool_use")
          .map(async (b) => {
            const tool = b as { type: "tool_use"; id: string; name: string; input: { query: string } };
            const result = await webSearch(tool.input.query);
            for (const m of result.matchAll(/\((https?:\/\/[^\s)]+)\)/g)) foundUrls.add(m[1]);
            return { type: "tool_result" as const, tool_use_id: tool.id, content: result };
          })
      );
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("");
    return { text, sources: [...foundUrls] };
  }

  return { text: "Não foi possível concluir a pesquisa nas tentativas disponíveis.", sources: [...foundUrls] };
}

/** Fase 2: pesquisa aberta de perfis sociais/LinkedIn, sob demanda. Nunca fonte oficial. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const auth = await authorize(user);
  if (auth.error) return auth.error;

  const { id } = await params;
  const service = svc();

  const { data: check } = await service
    .from("ma_investor_compliance_checks")
    .select("id, entity_name")
    .eq("id", id)
    .single();
  if (!check) return NextResponse.json({ error: "Checagem não encontrada" }, { status: 404 });

  let result;
  try {
    result = await runSocialSearch(check.entity_name);
  } catch (err) {
    return NextResponse.json(
      { error: `Erro na pesquisa de redes sociais: ${err instanceof Error ? err.message : String(err)}` },
      { status: 502 }
    );
  }

  const now = new Date().toISOString();
  const summaryText = `Pesquisa aberta realizada em ${new Date().toLocaleDateString("pt-BR")}. Não é fonte oficial de compliance e não há garantia de correspondência exata com a pessoa identificada.\n\n${result.text}`;

  const { error: updateError } = await service
    .from("ma_investor_compliance_checks")
    .update({
      social_summary_text: summaryText,
      social_summary_sources: result.sources,
      social_queried_at: now,
    })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({ social_summary_text: summaryText, social_summary_sources: result.sources, social_queried_at: now });
}
