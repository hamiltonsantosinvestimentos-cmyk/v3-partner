import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 30;

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL", "PARTNER_PRO"] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];

const SYSTEM_PROMPT = `
Voce e o Brand Voice Gate da V3 Partners. Sua funcao e validar se um texto esta
alinhado com a voz institucional da V3 Partners.

A V3 Partners usa dois arquetipos de voz:

- INSTITUCIONAL (Governante + Sabio): comunicacao de boutique financeira de alto padrao.
  Tom: confianca tecnica, precisao, sobriedade institucional. Linguagem culta e direta.
  Nunca: entusiasmo excessivo, girias, linguagem motivacional ou de coach,
  promessas vagas, exclamacoes, bullet points informais, emojis.
  Exemplos de uso: CIM, teaser, email para investidores, comunicados oficiais, propostas.

- COMUNIDADE (Heroi): comunicacao propositiva e direta para a rede de partners.
  Tom: acao concreta, conquista real, desafio com dados, direto ao ponto.
  Nunca: formal excessivo, diplomatico, vago, passivo, academico.
  Exemplos de uso: posts LinkedIn da comunidade V3, onboarding de partners, calls-to-action.

Criterios de avaliacao:
- Tom adequado ao arquetipo esperado
- Ausencia de linguagem proibida (coach, motivacional excessivo, informalidade indevida)
- Clareza e precisao da mensagem
- Consistencia do registro linguistico
- Vocabulario adequado ao publico-alvo (assessores, gestores, empresarios)

Retorne APENAS JSON valido, sem markdown, sem texto adicional:
{
  "score": <numero 0-100>,
  "archetype_match": "<Governante/Sabio | Heroi | Misto | Fora do arquetipo>",
  "issues": ["<desvio detectado>"],
  "suggestions": ["<sugestao de correcao>"]
}

Regras de score:
- 90-100: perfeito para o arquetipo
- 70-89: aprovado, pequenos ajustes possiveis
- 40-69: desvios relevantes, revisao necessaria
- 0-39: fora do arquetipo, reescrita necessaria

issues e suggestions: maximos 3 cada. Vazios se score >= 90.
`.trim();

function svc() {
  return sc(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });

    const db = svc();

    // Role check
    const { data: profile } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!ALLOWED_ROLES.includes(profile?.role as AllowedRole)) {
      return NextResponse.json({ error: "Sem permissao para validar voz da marca" }, { status: 403 });
    }

    // Parse body
    const body = await req.json() as {
      text?: string;
      context_type?: string;
      save_audit?: boolean;
    };

    const { text, context_type, save_audit = true } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: "text e obrigatorio" }, { status: 422 });
    }
    if (text.length > 5000) {
      return NextResponse.json({ error: "Texto excede limite de 5000 caracteres" }, { status: 422 });
    }
    if (context_type !== "institucional" && context_type !== "comunidade") {
      return NextResponse.json({ error: "context_type deve ser 'institucional' ou 'comunidade'" }, { status: 422 });
    }

    // Rate limit: 20 validacoes por minuto por usuario
    const { count } = await db
      .from("brand_voice_audits")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("created_at", new Date(Date.now() - 60_000).toISOString());

    if ((count ?? 0) >= 20) {
      return NextResponse.json(
        { error: "Limite de 20 validacoes por minuto atingido" },
        { status: 429 }
      );
    }

    // Chamada Claude Haiku
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY nao configurada" }, { status: 500 });
    }

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt =
      `Contexto esperado: ${context_type === "institucional" ? "INSTITUCIONAL (Governante/Sabio)" : "COMUNIDADE (Heroi)"}\n\n` +
      `Texto a validar:\n"""\n${text.trim()}\n"""`;

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const rawContent = message.content[0];
    if (rawContent.type !== "text") {
      throw new Error("Resposta inesperada da IA");
    }

    const raw = rawContent.text.trim()
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "");

    let parsed: {
      score: number;
      archetype_match: string;
      issues: string[];
      suggestions: string[];
    };

    try {
      parsed = JSON.parse(raw);
    } catch {
      console.error("[brand-voice-gate] JSON invalido do Claude:", raw.slice(0, 300));
      // Log nao-bloqueante
      db.from("execution_errors").insert({
        source: "brand-voice-gate",
        error:  "Claude retornou JSON invalido",
        severity: "low",
        status: "open",
      }).then(() => {}, () => {});
      return NextResponse.json({ error: "Erro interno ao processar resposta" }, { status: 500 });
    }

    const score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
    const passed = score >= 70;

    // Salvar audit log
    let audit_id: string | undefined;
    if (save_audit) {
      const { data: audit } = await db
        .from("brand_voice_audits")
        .insert({
          user_id:        user.id,
          context_type,
          input_text:     text.trim(),
          score,
          archetype_match: parsed.archetype_match ?? null,
          issues:         Array.isArray(parsed.issues) ? parsed.issues.slice(0, 3) : [],
          suggestions:    Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
        })
        .select("id")
        .single();

      audit_id = audit?.id;
    }

    return NextResponse.json({
      success: true,
      passed,
      score,
      archetype_match: parsed.archetype_match ?? "Desconhecido",
      issues:          Array.isArray(parsed.issues) ? parsed.issues.slice(0, 3) : [],
      suggestions:     Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 3) : [],
      ...(audit_id ? { audit_id } : {}),
    });

  } catch (error) {
    console.error("[brand-voice-gate] ERRO:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erro interno: ${msg}` }, { status: 500 });
  }
}
