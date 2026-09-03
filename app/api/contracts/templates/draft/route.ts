import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// POST /api/contracts/templates/draft — Agente Estruturador de Contratos
// (BRIEF 02/09/2026, aprovado por João). A Mesa descreve a intenção de
// negócio em texto livre, escolhe vertical/série V3C, e o agente redige a
// minuta completa a partir dessa descrição.
//
// ROTA ASSÍNCRONA POR DESENHO, mesmo padrão já em produção do Agente 2
// (analyze-upload/W17): esta rota só grava a linha em processando e
// dispara o webhook do n8n, a orquestração pesada roda lá. O callback que
// fecha o ciclo é POST /api/contracts/templates/[id]/draft-callback.
//
// DIFERENÇA DELIBERADA em relação ao Agente 2 (decisão explícita de João,
// 02/09/2026): a minuta gerada aqui cai e PERMANECE em approval_status =
// "rascunho" quando o callback conclui, nunca fast-track automático pra
// "em_revisao". Como nasce de uma descrição abstrata (não de um contrato
// já recebido/negociado), a Mesa Operacional precisa ler e refinar antes
// de clicar manualmente em "Enviar para Revisão Jurídica" -- não pode
// sobrecarregar o tempo do Dr. Athaydes com rascunho comercial imaturo.

const WRITE_ROLES = ["ADMIN", "GESTAO"] as const;
const VALID_SERIES = ["V3C-ORG", "V3C-MAN", "V3C-PAR", "V3C-CES", "V3C-NDA", "V3C-LOI", "V3C-FPA", "V3C-FOR", "V3C-FUN"];
const VALID_VERTICALS = ["capital_markets", "credito", "ma", "institucional", "clientes", "talent_pool", "colaboradores"];

// Série V3C nunca é escolhida pelo agente (governança de numeração,
// v3-numbering-governance.md): a Mesa declara vertical/série antes de
// chamar o agente, mesmo princípio já aplicado ao Agente 2.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !WRITE_ROLES.includes(profile.role as typeof WRITE_ROLES[number])) return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest) {
  const caller = await requireWriter();
  if (!caller)
    return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem acionar o Agente Estruturador de Contratos" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { descricao_intencao, vertical, contract_series, template_name: templateNameRaw } = body as {
    descricao_intencao?: string;
    vertical?: string;
    contract_series?: string;
    template_name?: string;
  };

  if (!descricao_intencao?.trim())
    return NextResponse.json({ error: "Descreva a intenção de negócio antes de acionar o agente" }, { status: 422 });
  if (descricao_intencao.trim().length < 30)
    return NextResponse.json({ error: "Descrição muito curta para o agente estruturar uma minuta com segurança (mínimo 30 caracteres)" }, { status: 422 });
  if (!vertical || !VALID_VERTICALS.includes(vertical))
    return NextResponse.json({ error: `vertical obrigatório, um de: ${VALID_VERTICALS.join(", ")}` }, { status: 422 });
  if (!contract_series || !VALID_SERIES.includes(contract_series))
    return NextResponse.json({ error: `contract_series obrigatório, um de: ${VALID_SERIES.join(", ")}` }, { status: 422 });

  const db = svc();

  // Contexto anti-alucinação (achado real ao montar o BRIEF, não estava no
  // draft original): a diretriz "use o tom e a estrutura já aprovados"
  // não tinha como o agente cumprir sozinho sem receber exemplo nenhum.
  // Busca até 3 minutas já aprovadas da MESMA vertical pra servir de
  // referência real no prompt; se não houver nenhuma, o agente é avisado
  // explicitamente disso, nunca finge ter uma referência inexistente.
  const { data: referenceTemplates } = await db
    .from("contract_templates")
    .select("template_name, body_text_raw")
    .eq("vertical", vertical)
    .eq("approval_status", "aprovado")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(3);

  const templateName = templateNameRaw?.trim() || `Estruturação IA · ${descricao_intencao.trim().slice(0, 60)}`;

  const { data: template, error: insertErr } = await db
    .from("contract_templates")
    .insert({
      template_name: templateName,
      vertical,
      contract_series,
      body_text_raw: `[Estruturando minuta a partir da intenção de negócio descrita pela Mesa...]\n\n${descricao_intencao.trim()}`,
      origem: "agente_ia_estruturador",
      analysis_status: "processando",
      created_by: caller.userId,
    })
    .select("id")
    .single();

  if (insertErr || !template)
    return NextResponse.json({ error: insertErr?.message ?? "Erro ao criar minuta" }, { status: 500 });

  const templateId = template.id as string;

  const n8nBase = process.env.N8N_API_URL?.replace("/api/v1", "");
  if (!n8nBase) {
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "N8N_API_URL não configurada — estruturação não pode ser disparada",
    }).eq("id", templateId);
    return NextResponse.json({ error: "Integração de estruturação não configurada (N8N_API_URL ausente)" }, { status: 500 });
  }

  try {
    await fetch(`${n8nBase}/webhook/v3-contract-draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-cron-secret": process.env.CRON_SECRET ?? "" },
      body: JSON.stringify({
        template_id: templateId,
        descricao_intencao: descricao_intencao.trim(),
        vertical,
        contract_series,
        reference_templates: (referenceTemplates ?? []).map((t) => ({
          template_name: t.template_name,
          // guarda de tamanho, mesmo espírito do limite de páginas do resto do sistema
          body_text_raw: (t.body_text_raw as string).slice(0, 12000),
        })),
      }),
    });
  } catch (e) {
    console.error("[templates/draft] webhook n8n falhou:", e);
    await db.from("contract_templates").update({
      analysis_status: "erro",
      analysis_error: "Não foi possível acionar o Agente Estruturador de Contratos. Tente novamente em 1 minuto.",
    }).eq("id", templateId);
    return NextResponse.json({ error: "Agente de estruturação indisponível. Tente novamente em 1 minuto." }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    template_id: templateId,
    analysis_status: "processando",
    message: "Estruturação iniciada. O Agente Estruturador de Contratos está redigindo a minuta a partir da intenção descrita.",
  }, { status: 202 });
}
