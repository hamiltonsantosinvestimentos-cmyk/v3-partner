import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { hasComplianceDashboardAccess } from "@/lib/cm/compliance-access";
import { buildComplianceDossierData } from "@/lib/compliance-dossier-data";
import { auditText } from "@/lib/brand-guardian-gate";

// POST /api/cm/listings/[id]/compliance-dossier/compile -- Cockpit de
// Compliance, Fase 4 (10/09/2026). Compila o parecer do Dossiê de Risco,
// mesmo padrão do Forja Jurídico (app/api/cm/forja/compile-thesis), agora
// cruzando também a Checktudo (Fase 2) e os intermediários qualificados
// (Fase 3), que o Forja Jurídico não tinha na origem.

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = await hasComplianceDashboardAccess(user?.id);
  if (!allowed) return NextResponse.json({ error: "Sem permissão" }, { status: 403 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY não configurada" }, { status: 500 });
  }

  const { id } = await params;
  const data = await buildComplianceDossierData(id);
  if (!data) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });

  // Não recompila depois que o quórum já fechou -- o parecer que as 2
  // assinaturas cobriram não deve mudar por baixo delas sem revogar o
  // quórum primeiro (mesmo espírito de contract_templates: editar depois
  // de aprovado reseta a aprovação, mas isso é decisão de escopo futura,
  // não implementada nesta fase -- por ora só bloqueia).
  const { data: listingRow } = await svc().from("cm_asset_listings").select("risk_dossier_finalized_at").eq("id", id).single();
  if (listingRow?.risk_dossier_finalized_at) {
    return NextResponse.json({ error: "Dossiê já finalizado com quórum fechado. Não é possível recompilar." }, { status: 409 });
  }

  const docsSummary = data.docs
    .map((d) => `- [${d.document_type}] ${d.original_filename ?? "sem nome"} (status: ${d.validation_status ?? "n/d"}, confiabilidade: ${d.confiabilidade ?? "n/d"})`)
    .join("\n") || "Nenhum documento anexado ainda.";

  const ddSummary = data.ddRecords
    .map((r) => `- [${r.tool} · ${r.query_type}] "${r.query_value}": ${r.totalProcessos ?? "n/d"} processo(s)`)
    .join("\n") || "Nenhuma consulta de due diligence realizada ainda.";

  const checktudoSummary = data.checktudoRecords
    .map((r) => `- Querycode ${r.querycode}: ${JSON.stringify(r.risk_flags)}`)
    .join("\n") || "Nenhuma varredura Checktudo realizada ainda.";

  const intermediariesSummary = data.intermediaries
    .map((p) => `- ${p.full_name} (${p.role_in_document}): ${p.checked ? "antecedentes checados" : "antecedentes PENDENTES"}`)
    .join("\n") || "Nenhum intermediário qualificado neste ativo.";

  const valor = data.valorFace ? `R$ ${Number(data.valorFace).toLocaleString("pt-BR")}` : "não informado";

  const prompt = `Você é um analista de compliance sênior da V3 Partners, escrevendo o PARECER do DOSSIÊ DE RISCO ` +
    `de um ativo da Bolsa de Ativos, para uso da Mesa e da Governança (Dr. Luís Athaydes). Uso interno, cite nomes ` +
    `e dados reais livremente. NUNCA invente dado que não esteja nas fontes abaixo -- se uma informação não está ` +
    `disponível, escreva explicitamente "não disponível nas fontes analisadas", nunca preencha com suposição. ` +
    `Ausência de dado NUNCA significa ausência de risco -- reporte a ausência como tal.\n\n` +
    `── CADASTRO DO ATIVO ──\n` +
    `Código: ${data.anonymousId}\nTipo: ${data.assetType}\n` +
    `Cedente: ${data.sellerName}${data.sellerCpfCnpj ? ` (${data.sellerCpfCnpj})` : ""}\n` +
    `Ente Devedor: ${data.enteDevedor ?? "não informado"}\nValor de Face: ${valor}\n` +
    `Score V3: ${data.riskScore ?? "não calculado"}/100\nStatus na esteira: ${data.listingStatus}\n\n` +
    `── DOCUMENTOS (${data.docs.length}) ──\n${docsSummary}\n\n` +
    `── DUE DILIGENCE / ESCAVADOR (${data.ddRecords.length}) ──\n${ddSummary}\n\n` +
    `── CHECKTUDO / SCR E DOSSIÊ JURÍDICO (${data.checktudoRecords.length}) ──\n${checktudoSummary}\n\n` +
    `── INTERMEDIÁRIOS QUALIFICADOS (${data.intermediaries.length}) ──\n${intermediariesSummary}\n\n` +
    `Escreva o parecer com estas seções, nesta ordem, em português institucional, direto, SEM travessão ` +
    `(use vírgula, dois-pontos ou ponto), SEM markdown, SEM emojis:\n` +
    `1. RESUMO DO ATIVO (2-3 frases)\n` +
    `2. SITUAÇÃO DOCUMENTAL (o que foi analisado, o que falta)\n` +
    `3. ACHADOS DE DUE DILIGENCE E CHECKTUDO (resuma os achados reais, ou declare ausência se não houver consulta)\n` +
    `4. RISCOS IDENTIFICADOS (liste riscos concretos encontrados nas fontes, incluindo intermediários com ` +
    `antecedentes pendentes se houver, nunca riscos genéricos)\n` +
    `5. RECOMENDAÇÃO PRELIMINAR (avançar / avançar com ressalvas / não avançar, com justificativa)\n`;

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let rawText: string;
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3000,
      messages: [{ role: "user", content: prompt }],
    });
    rawText = (msg.content[0] as { text: string }).text.trim();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ error: `Falha ao gerar parecer: ${message}` }, { status: 502 });
  }

  const gate = auditText(rawText);

  const { data: updated, error } = await svc()
    .from("cm_asset_listings")
    .update({
      risk_dossier_text: gate.corrected,
      risk_dossier_generated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("risk_dossier_text, risk_dossier_generated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    risk_dossier_text: updated.risk_dossier_text,
    risk_dossier_generated_at: updated.risk_dossier_generated_at,
    sources: { documents: data.docs.length, due_diligence_records: data.ddRecords.length, checktudo_records: data.checktudoRecords.length },
    brand_gate: { violations_found: gate.violations.length },
  });
}
