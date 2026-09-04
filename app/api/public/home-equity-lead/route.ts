import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";
import { z } from "zod";

// Recebe a qualificação completa do Simulador Home Equity público
// (/simulador-home-equity-v3) e cria um lead "Digital" no CRM — mesmo
// destino dos outros links de captação (app/api/captacao/submit), só que
// sem exigir um captacao_links.token: o partner é resolvido direto pelo
// ?ref=<partner_id> da própria página pública.
//
// NÃO cria credit_desk_proposals (diferente de /api/captacao/submit) — aqui
// é só uma simulação qualificada, sem documentos anexados. Fica pro partner/
// Mesa avançar manualmente a partir do lead, como qualquer lead Digital.

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Mesmo padrão de geração de código usado em app/api/captacao/submit/route.ts
// pra crm_leads (prefixo CRM-26) — essa tabela não faz parte da governança
// estrita de app/lib/v3-codes.ts (séries MA/CR/CRI/BA/PR/CS/V3C-*).
async function nextLeadCode(db: ReturnType<typeof svc>): Promise<string> {
  const { data } = await db.from("crm_leads").select("code").like("code", "CRM-26-%");
  const re = /^CRM-26-(\d+)$/;
  let max = 0;
  for (const row of (data ?? []) as { code: string }[]) {
    const m = row.code.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `CRM-26-${String(max + 1).padStart(4, "0")}`;
}

const schema = z.object({
  ref: z.string().optional().nullable(),
  objetivo: z.string().min(1),
  urgencia: z.string().min(1),
  perfilImovel: z.string().min(1),
  prazoMeses: z.number().int().positive(),
  valorImovel: z.number().positive(),
  valorCredito: z.number().positive(),
  tipoPessoa: z.enum(["PF", "PJ"]),
  averbado: z.boolean(),
  statusImovel: z.enum(["FINANCIADO", "QUITADO"]),
  bancoFinanciamento: z.string().optional().nullable(),
  valorFinanciamento: z.number().optional().nullable(),
  nome: z.string().min(3),
  cpf: z.string().min(11),
  ocupacao: z.string().min(1),
  renda: z.number().nonnegative(),
  nascimento: z.string().optional().nullable(),
  telefone: z.string().min(8),
  email: z.string().email(),
  cep: z.string().optional().nullable(),
  estado: z.string().min(2).max(2),
  cidade: z.string().min(1),
  bairro: z.string().optional().nullable(),
  rua: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  consentimentoScr: z.literal(true),
});

const PARTNER_ROLES = ["STARTER", "PARTNER", "PARTNER_PRO", "ENTERPRISE", "ADMIN", "GESTAO", "MESA_OPERACIONAL"];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.data ? "Dados inválidos" : "JSON inválido", details: parsed.error?.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;

  const db = svc();

  // Resolve partner de atribuição pelo ?ref= (opcional — sem ref, lead fica
  // sem partner_id e só ADMIN/GESTAO veem no CRM até alguém assumir).
  let partnerId: string | null = null;
  let partnerName: string | null = null;
  if (d.ref && /^[0-9a-f-]{36}$/i.test(d.ref)) {
    const { data: p } = await db.from("profiles").select("id, full_name, role").eq("id", d.ref).single();
    if (p && PARTNER_ROLES.includes((p as { role?: string }).role ?? "")) {
      partnerId = p.id;
      partnerName = p.full_name ?? null;
    }
  }

  const code = await nextLeadCode(db);
  const annualRevenue = d.renda * 12;

  const { data: lead, error } = await db.from("crm_leads").insert({
    code,
    name: d.nome.trim(),
    document: d.cpf,
    person_type: d.tipoPessoa,
    email: d.email,
    phone: d.telefone,
    segment: "Home Equity / CGI",
    annual_revenue: annualRevenue,
    city: d.cidade,
    state: d.estado.toUpperCase(),
    status: "prospect",
    source: "digital",
    visit_date: null,
    next_contact: null,
    notes: null,
    product_interest: "credito_estruturado",
    credit_line: "HOME EQUITY",
    partner_id: partnerId,
    partner_name: partnerName,
    created_by: partnerId,
    interactions: [],
    metadata: {
      form_type: "home_equity_simulador_publico",
      objetivo: d.objetivo,
      urgencia: d.urgencia,
      perfil_imovel: d.perfilImovel,
      prazo_meses: d.prazoMeses,
      valor_imovel: d.valorImovel,
      valor_credito: d.valorCredito,
      averbado: d.averbado,
      status_imovel: d.statusImovel,
      banco_financiamento: d.bancoFinanciamento ?? null,
      valor_financiamento: d.valorFinanciamento ?? null,
      ocupacao: d.ocupacao,
      renda_mensal: d.renda,
      nascimento: d.nascimento ?? null,
      cep: d.cep ?? null,
      bairro: d.bairro ?? null,
      rua: d.rua ?? null,
      numero: d.numero ?? null,
      complemento: d.complemento ?? null,
      consentimento_scr: true,
      consentimento_versao: "v1-rascunho-2026-09-04",
      ref_partner_id: d.ref ?? null,
      submitted_at: new Date().toISOString(),
    },
  }).select("id, code").single();

  if (error || !lead) {
    return NextResponse.json({ error: error?.message ?? "Falha ao registrar simulação" }, { status: 500 });
  }

  // Espelha em prospeccao_leads pra visibilidade de ADMIN/SDR/CLOSER — mesmo
  // padrão de app/api/captacao/submit. Fire-and-forget.
  db.from("prospeccao_leads").insert({
    nome: d.nome.trim(),
    documento: d.cpf,
    email: d.email,
    telefone: d.telefone,
    cidade: d.cidade,
    estado: d.estado.toUpperCase(),
    origem: "indicacao_partner",
    indicado_por_partner_id: partnerId,
    indicado_por_nome: partnerName,
    responsavel_id: null,
    responsavel_nome: null,
    notas: `Simulador Home Equity — imóvel ${d.perfilImovel}, valor ${d.valorImovel}, crédito desejado ${d.valorCredito}, objetivo ${d.objetivo}.`,
    etapa: "prospect",
    created_by: partnerId,
    crm_lead_id: lead.id,
  }).then(() => {}, () => {});

  return NextResponse.json({ ok: true, code: lead.code });
}
