import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { webSearch } from "@/lib/web-search";
import type Anthropic from "@anthropic-ai/sdk";

async function getAuthedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };
  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  return { user, profile };
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

const searchSchema = z.object({
  cep: z.string().max(12).optional().nullable(),
  cidade: z.string().max(120).optional().nullable(),
  estado: z.string().max(2).optional().nullable(),
  area_m2: z.number().gt(0, "Área do imóvel deve ser maior que zero"),
});

interface Comparavel {
  titulo: string;
  valor: number;
  area_m2: number;
  fonte_nome: string;
  fonte_url: string;
}

interface ComparavelComputado extends Comparavel {
  preco_m2: number;
}

const MAX_TOOL_ITERATIONS = 4;

// Extrai o objeto JSON da resposta do modelo, tolerando texto/markdown ao redor
function extrairJson(raw: string): { comparaveis?: Comparavel[]; confianca?: string; observacoes?: string } | null {
  const semFences = raw.replace(/```(?:json)?/gi, "").trim();
  try {
    return JSON.parse(semFences);
  } catch { /* tenta o fallback abaixo */ }

  const inicio = semFences.indexOf("{");
  const fim = semFences.lastIndexOf("}");
  if (inicio === -1 || fim === -1 || fim <= inicio) return null;
  try {
    return JSON.parse(semFences.slice(inicio, fim + 1));
  } catch {
    return null;
  }
}

// Loop de tool-use com web_search — encerra em MAX_TOOL_ITERATIONS forçando síntese em JSON
async function buscarComparaveis(
  anthropic: InstanceType<typeof import("@anthropic-ai/sdk").default>,
  system: string,
  userPrompt: string
): Promise<string> {
  const tools: Array<{ name: string; description: string; input_schema: Record<string, unknown> }> = [{
    name: "web_search",
    description: "Busca anúncios reais de imóveis à venda na internet para uma região específica.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Termo de busca preciso em português, incluindo cidade/UF/bairro" },
      },
      required: ["query"],
    },
  }];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const currentMessages: any[] = [{ role: "user", content: userPrompt }];
  let iteration = 0;

  while (iteration < MAX_TOOL_ITERATIONS) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system,
      messages: currentMessages,
      tools: tools as unknown as Anthropic.Messages.Tool[],
    });

    if (response.stop_reason === "tool_use") {
      currentMessages.push({ role: "assistant", content: response.content });
      const toolResults = await Promise.all(
        response.content
          .filter(b => b.type === "tool_use")
          .map(async (b) => {
            const tool = b as { type: "tool_use"; id: string; name: string; input: { query: string } };
            const result = await webSearch(tool.input.query);
            return { type: "tool_result" as const, tool_use_id: tool.id, content: result };
          })
      );
      currentMessages.push({ role: "user", content: toolResults });
      iteration++;
      continue;
    }

    return response.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("");
  }

  // Última tentativa — força resposta em JSON sem tools
  const finalResponse = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system,
    messages: [
      ...currentMessages,
      { role: "user", content: 'Você já pesquisou o suficiente. Responda AGORA apenas com o JSON final, sem mais buscas, sem markdown e sem nenhum texto explicativo antes ou depois — mesmo que não tenha encontrado nenhum comparável, responda com {"comparaveis":[],"confianca":"BAIXA","observacoes":"..."} explicando brevemente o motivo em "observacoes".' },
    ],
  });
  return finalResponse.content
    .filter(b => b.type === "text")
    .map(b => (b as { type: "text"; text: string }).text)
    .join("");
}

// POST — pesquisa comparáveis de venda na região e calcula valor de mercado por m²
export async function POST(req: NextRequest) {
  const { user, profile } = await getAuthedUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ALLOWED_ROLES.includes(profile?.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada no servidor" }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const { cep, cidade, estado, area_m2 } = parsed.data;

  if (!cep && !(cidade && estado)) {
    return NextResponse.json({ error: "Informe ao menos CEP, ou cidade e estado do imóvel" }, { status: 400 });
  }

  const regiao = [cep ? `CEP ${cep}` : null, cidade, estado].filter(Boolean).join(", ");

  const system = `Você é um assistente de pesquisa de mercado imobiliário da V3 Partners. Sua tarefa é usar a tool "web_search" para encontrar de 3 a 6 anúncios REAIS de imóveis à venda (não aluguel) na mesma região informada pelo usuário — priorize a mesma cidade/UF e, quando encontrar, o mesmo bairro/CEP. Prefira anúncios recentes de portais como ZAP Imóveis, VivaReal, OLX, QuintoAndar, Imovelweb ou sites de imobiliárias locais.

Depois de pesquisar, responda SOMENTE com um JSON válido (sem markdown, sem texto antes ou depois), no formato exato:
{"comparaveis":[{"titulo":"...","valor":1000000,"area_m2":300,"fonte_nome":"ZAP Imóveis","fonte_url":"https://..."}],"confianca":"ALTA|MEDIA|BAIXA","observacoes":"..."}

Regras:
- "valor" é o preço de venda anunciado em reais (número, sem formatação).
- "area_m2" é a área do imóvel do anúncio em metros quadrados (número).
- Nunca invente valores — se não encontrar comparáveis suficientes, retorne o array com o que encontrou (mesmo que só 1 ou 2) e "confianca":"BAIXA".
- "observacoes" deve mencionar brevemente a qualidade dos comparáveis encontrados (ex.: região exata vs. cidade genérica).`;

  const userPrompt = `Pesquise vendas comparáveis de imóveis na região: ${regiao}. O imóvel da proposta em avaliação tem ${area_m2}m².`;

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const raw = await buscarComparaveis(client, system, userPrompt);
    const aiResult = extrairJson(raw);
    if (!aiResult) {
      // Modelo respondeu em texto livre (comum quando a busca não acha nada, ex.: cidades
      // pequenas) em vez do JSON pedido — degrada para "nenhum comparável" em vez de bloquear.
      console.error("[avaliacao-mercado] resposta da IA não pôde ser interpretada como JSON:", raw);
      return NextResponse.json({
        comparaveis: [],
        preco_m2_medio: 0,
        valor_estimado: 0,
        confianca: "BAIXA",
        observacoes: "Não foi possível encontrar comparáveis de mercado confiáveis para esta região. Tente novamente ou avalie o imóvel manualmente.",
        buscado_em: new Date().toISOString(),
      });
    }

    const comparaveisValidos: ComparavelComputado[] = (aiResult.comparaveis ?? [])
      .filter((c): c is Comparavel => Boolean(c) && typeof c.valor === "number" && c.valor > 0 && typeof c.area_m2 === "number" && c.area_m2 > 0)
      .map(c => ({ ...c, preco_m2: c.valor / c.area_m2 }));

    if (comparaveisValidos.length === 0) {
      return NextResponse.json({
        comparaveis: [],
        preco_m2_medio: 0,
        valor_estimado: 0,
        confianca: "BAIXA",
        observacoes: aiResult.observacoes ?? "Nenhum comparável válido encontrado para a região informada.",
        buscado_em: new Date().toISOString(),
      });
    }

    const preco_m2_medio = comparaveisValidos.reduce((sum, c) => sum + c.preco_m2, 0) / comparaveisValidos.length;
    const valor_estimado = preco_m2_medio * area_m2;
    const confianca = comparaveisValidos.length < 2 ? "BAIXA" : (aiResult.confianca ?? "MEDIA");

    return NextResponse.json({
      comparaveis: comparaveisValidos,
      preco_m2_medio,
      valor_estimado,
      confianca,
      observacoes: aiResult.observacoes ?? "",
      buscado_em: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Erro ao pesquisar valor de mercado" }, { status: 502 });
  }
}
