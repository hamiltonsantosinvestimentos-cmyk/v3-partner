import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditHtml } from "@/lib/brand-guardian-gate";

export const maxDuration = 300;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type ValidatedField = { field: string; value: string; note?: string };
type ForjaResult = {
  score: number;
  validated: ValidatedField[];
  tese_investimento?: string[];
  narrative_pt: string;
  narrative_en: string;
  recommendation: string;
  recommendation_note: string;
};

// Campos que identificam a empresa ou expõem dados internos — NUNCA no teaser cego
const BLIND_PATTERNS = [
  // Identidade
  "id", "code", "target_company", "cnpj", "razao_social", "nome_fantasia",
  // Localização exata
  "location", "localizacao", "endereco", "address", "cep", "rua",
  "municipio", "cidade", "bairro", "numero", "logradouro",
  // Contatos
  "contato", "email", "telefone", "whatsapp", "instagram", "linkedin", "website",
  "responsavel", "vendedor", "comprador",
  // Dados financeiros internos
  "comissionamento", "commission", "fee", "honorario",
  "divida_total", "divida", "debt",
  // Dados jurídicos identificáveis
  "processo_v3", "processo_regulatorio", "processo_judicial",
  "assessor_juridico", "advogado",
  // Documentos e registros
  "matricula", "car", "itr", "registro",
];
function isBlind(field: string): boolean {
  const lower = field.toLowerCase();
  return BLIND_PATTERNS.some(p => lower.includes(p));
}

function formatM(v: number | null | undefined): string {
  if (!v) return "N/D";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

// Gera 5 bullets de tese de investimento via Claude Haiku
async function gerarTeseInvestimento(params: {
  sector: string;
  regiao: string;
  valor: number;
  narrativaPt: string;
  dealContext: string;
}): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];

  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt =
    `Você é analista sênior de M&A da V3 Partners. Com base nas informações abaixo, gere EXATAMENTE 5 bullets de tese de investimento para um teaser cego.\n\n` +
    `Setor: ${params.sector}\n` +
    `Região: ${params.regiao}\n` +
    `Valor: ${formatM(params.valor)}\n` +
    `Contexto: ${params.dealContext}\n` +
    `Narrativa: ${params.narrativaPt}\n\n` +
    `Regras:\n` +
    `- Cada bullet em 1 frase objetiva e impactante\n` +
    `- Foco em por que o investidor deve QUERER conhecer o ativo\n` +
    `- NÃO mencione nome da empresa, cidade exata ou contatos\n` +
    `- Destaque: barreiras de entrada, potencial de upside, estrutura financeira favorável, posição de mercado\n` +
    `- Tom: institucional, direto, sem exageros\n` +
    `- Formato: retorne APENAS uma linha por bullet, sem numeração, sem traços iniciais, sem markdown\n` +
    `- Primeira palavra de cada bullet deve ser um verbo forte (Ex: Adquira, Acesse, Capture, Consolide, Aproveite...)`;

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (msg.content[0] as { text: string }).text.trim();
    return text
      .split("\n")
      .map(l => l.replace(/^[-•·*\d.)\s]+/, "").trim())
      .filter(l => l.length > 10)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function buildTeaserHtml(params: {
  code: string;
  sector: string;
  regiao: string;
  valor: number;
  dealType: string;
  dealEstrutura: string;
  forjaResult: ForjaResult;
  teseInvestimento: string[];
  highlights: { label: string; value: string }[];
  generatedAt: string;
  baseUrl: string;
}): string {
  const { baseUrl } = params;
  const { code, sector, regiao, valor, dealType, dealEstrutura, forjaResult, teseInvestimento, highlights, generatedAt } = params;

  const teseHtml = teseInvestimento.length > 0
    ? teseInvestimento.map(b =>
        `<div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
          <div style="width:6px;height:6px;border-radius:50%;background:#C9A84C;flex-shrink:0;margin-top:4px;"></div>
          <p style="margin:0;font-size:11px;color:#E8EDF5;line-height:1.65;">${b}</p>
        </div>`).join("")
    : `<p style="font-size:11px;color:#7A8FA8;">Ativo com tese estruturada — informações completas disponíveis mediante NDA.</p>`;

  const highlightCards = highlights.slice(0, 8).map(h =>
    `<div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:12px 14px;">
      <p style="margin:0 0 3px;font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7A8FA8;">${h.label}</p>
      <p style="margin:0;font-size:12px;font-weight:600;color:#F0ECE4;">${h.value}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Teaser Cego · ${sector} · V3 Partners</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    @page { size: A4 portrait; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 28px 0; }
    .page { width: 794px; background: #09081A; margin: 0 auto 24px; box-shadow: 0 4px 40px rgba(0,0,0,.7); }
    .stripe { height: 4px; background: linear-gradient(to right,#09081A,#C9A84C,#E8C97A,#C9A84C,#09081A); }
    .no-print { display:block; text-align:center; padding:8px; font-size:10px; color:#7A8FA8; background:#162744; }
    @media print {
      .no-print { display:none!important; }
      html, body { background:#09081A!important; padding:0!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
      .page { width:210mm!important; margin:0!important; box-shadow:none!important; }
    }
  </style>
</head>
<body>
<div class="no-print">Ctrl+P → Salvar como PDF → Sem margens · Gráficos de fundo ativado</div>
<div class="page">
<div class="stripe"></div>

<!-- ═══ CAPA ═══════════════════════════════════════════════════════════ -->
<div style="background:#09081A;padding:52px 52px 44px;border-bottom:1px solid #162744;">

  <!-- Logo + badge -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:52px;">
    <img src="${baseUrl}/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:38px;width:auto;"/>
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7A8FA8;border:1px solid #243A66;padding:5px 12px;border-radius:2px;">Documento Cego</div>
      <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;border:1px solid rgba(201,168,76,0.4);padding:5px 12px;border-radius:2px;">NDA Requerido</div>
    </div>
  </div>

  <!-- Eyebrow -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
    <div style="width:28px;height:2px;background:#C9A84C;"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;">Oportunidade M&A · V3 Partners</span>
  </div>

  <!-- Título principal -->
  <h1 style="font-size:52px;font-weight:800;line-height:1.0;letter-spacing:-1.5px;color:#F0ECE4;margin-bottom:8px;">
    Aquisição<br/><span style="color:#C9A84C;">${sector}</span>
  </h1>
  <p style="font-size:14px;color:#7A8FA8;margin-bottom:40px;font-weight:400;">${dealType ? dealType + ' · ' : ''}${regiao}</p>

  <!-- KPIs principais -->
  <div style="display:grid;grid-template-columns:auto auto 1fr;gap:0;margin-bottom:44px;">
    <div style="padding-right:32px;border-right:1px solid #162744;">
      <p style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7A8FA8;margin-bottom:6px;">Valor da Operação</p>
      <p style="font-size:32px;font-weight:800;color:#C9A84C;line-height:1;">${formatM(valor)}</p>
    </div>
    <div style="padding-left:32px;padding-right:32px;border-right:1px solid #162744;">
      <p style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7A8FA8;margin-bottom:6px;">Setor</p>
      <p style="font-size:20px;font-weight:700;color:#F0ECE4;line-height:1;">${sector}</p>
    </div>
    <div style="padding-left:32px;">
      <p style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#7A8FA8;margin-bottom:6px;">Região</p>
      <p style="font-size:20px;font-weight:700;color:#F0ECE4;line-height:1;">${regiao}</p>
    </div>
  </div>

  <!-- Estrutura do deal highlight -->
  ${dealEstrutura ? `
  <div style="background:rgba(201,168,76,0.08);border:1px solid rgba(201,168,76,0.25);border-radius:6px;padding:14px 18px;">
    <p style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:5px;">Estrutura do Deal</p>
    <p style="font-size:12px;color:#E8EDF5;line-height:1.6;">${dealEstrutura}</p>
  </div>` : ""}

</div>

<!-- ═══ TESE DE INVESTIMENTO ═══════════════════════════════════════════ -->
<div style="background:#111F35;padding:36px 52px;border-bottom:1px solid #162744;">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;">
    <div style="width:24px;height:2px;background:#C9A84C;"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">Por que este ativo?</span>
  </div>

  <div style="border-left:3px solid #C9A84C;padding-left:20px;">
    ${teseHtml}
  </div>

</div>

<!-- ═══ HIGHLIGHTS OPERACIONAIS ════════════════════════════════════════ -->
${highlights.length > 0 ? `
<div style="padding:32px 52px;border-bottom:1px solid #162744;">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
    <div style="width:24px;height:2px;background:#C9A84C;"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">Dados do Ativo</span>
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${highlightCards}
  </div>

</div>` : ""}

<!-- ═══ DESCRIÇÃO DO ATIVO ═════════════════════════════════════════════ -->
<div style="background:#111F35;padding:32px 52px;border-bottom:1px solid #162744;">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
    <div style="width:24px;height:2px;background:#C9A84C;"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">Descrição do Ativo</span>
  </div>

  <p style="font-size:11px;color:#C4CDD8;line-height:1.85;border-left:2px solid rgba(201,168,76,0.3);padding-left:16px;">${forjaResult.narrative_pt}</p>

</div>

<!-- ═══ INVESTMENT NARRATIVE EN ════════════════════════════════════════ -->
<div style="padding:32px 52px;border-bottom:1px solid #162744;">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
    <div style="width:24px;height:2px;background:#C9A84C;"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;">Investment Narrative — English</span>
  </div>

  <p style="font-size:11px;color:#C4CDD8;line-height:1.85;border-left:2px solid rgba(201,168,76,0.3);padding-left:16px;">${forjaResult.narrative_en}</p>

</div>

<!-- ═══ CTA ═══════════════════════════════════════════════════════════ -->
<div style="background:#09081A;padding:36px 52px 40px;">

  <div style="background:linear-gradient(135deg,#162744,#0F1E35);border:1px solid rgba(201,168,76,0.3);border-radius:10px;padding:28px 32px;text-align:center;">
    <p style="font-size:9px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#C9A84C;margin-bottom:10px;">Próximo Passo</p>
    <h2 style="font-size:18px;font-weight:700;color:#F0ECE4;margin-bottom:8px;">Solicite o Information Memorandum Completo</h2>
    <p style="font-size:11px;color:#7A8FA8;margin-bottom:20px;line-height:1.6;">Acesso às informações confidenciais — dados financeiros, estrutura jurídica e plano operacional — disponibilizado após qualificação do interesse e assinatura do NDA.</p>
    <div style="display:inline-block;background:#C9A84C;color:#09081A;font-size:12px;font-weight:800;letter-spacing:1px;padding:12px 32px;border-radius:6px;margin-bottom:12px;">mesa@v3partners.com.br</div>
    <p style="font-size:10px;color:#7A8FA8;">v3partners.com.br · +55 21 98993-7178 · Ipanema, Rio de Janeiro</p>
  </div>

</div>

<!-- ═══ RODAPÉ ══════════════════════════════════════════════════════════ -->
<div style="background:#09081A;border-top:1px solid #162744;padding:10px 52px;display:flex;justify-content:space-between;align-items:center;">
  <p style="font-size:7px;color:#7A8FA8;line-height:1.6;">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · Confidencial · ${code} · ${generatedAt}</p>
  <p style="font-size:7px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(201,168,76,0.35);">Destinado exclusivamente a investidores qualificados</p>
</div>

</div>
</body>
</html>`;
}

function getBaseUrl(req: NextRequest): string {
  const host = req.headers.get("host") ?? "app.v3partners.com.br";
  const proto = host.startsWith("localhost") ? "http" : "https";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { deal_id } = await req.json() as { deal_id: string };
  if (!deal_id) return NextResponse.json({ error: "deal_id obrigatório" }, { status: 400 });

  const { data: deal, error } = await db
    .from("ma_deals")
    .select("id, code, target_company, sector, deal_value, location, notes, asset_data")
    .eq("id", deal_id).single();

  if (error || !deal) return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });

  const ad = (deal.asset_data ?? {}) as Record<string, unknown>;
  const forjaResult = ad.forja_result as ForjaResult | undefined;

  if (!forjaResult?.narrative_pt) {
    return NextResponse.json({
      error: "Execute o FORJA primeiro para gerar a narrativa antes de criar o teaser cego.",
    }, { status: 422 });
  }

  // Região SEMPRE cega: apenas UF/estado — nunca cidade, endereço ou CEP
  const loc = (deal.location ?? "") as string;
  const regiaoBlind = (() => {
    // Tenta extrair UF de 2 letras maiúsculas
    const ufMatch = loc.match(/\b(AC|AL|AM|AP|BA|CE|DF|ES|GO|MA|MG|MS|MT|PA|PB|PE|PI|PR|RJ|RN|RO|RR|RS|SC|SE|SP|TO)\b/);
    if (ufMatch) return ufMatch[1];
    // Tenta nome do estado
    const estadoMap: Record<string, string> = {
      "rio de janeiro": "RJ", "são paulo": "SP", "minas gerais": "MG",
      "bahia": "BA", "paraná": "PR", "rio grande do sul": "RS",
      "santa catarina": "SC", "pernambuco": "PE", "ceará": "CE",
      "goiás": "GO", "espírito santo": "ES", "mato grosso": "MT",
    };
    const lower = loc.toLowerCase();
    for (const [estado, uf] of Object.entries(estadoMap)) {
      if (lower.includes(estado)) return uf;
    }
    // Pega apenas a ÚLTIMA parte separada por vírgula/traço (geralmente o estado)
    const parts = loc.split(/[,\-·]/).map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) return parts[parts.length - 1];
    // Se não conseguiu extrair, retorna genérico — nunca endereço completo
    return "Brasil";
  })();

  // Tipo de deal
  const dealType = (
    (ad.tipo_oportunidade as string) ??
    (ad.deal_type as string) ??     // deal_type vive em asset_data para TEASER_CEGO
    ""
  ).replace("TEASER_CEGO", "").trim();

  // Estrutura do deal — APENAS da narrativa FORJA (nunca de notes — pode conter comissão/NDA)
  const dealEstrutura = (() => {
    const match = forjaResult.narrative_pt.match(
      /estrutura[^.]{0,200}(entrada|assun[çc][aã]o|dívida)[^.]*\./i
    );
    return match ? match[0].trim() : "";
  })();

  // Palavras que revelam localização pelo contexto (nomes de ruas, cidades, concorrentes locais)
  function valueRevealLocation(val: string): boolean {
    const lower = val.toLowerCase();
    return (
      /\bav(enida)?\b|\brua\b|\bpraça\b|\bcep\b|\bn°|\bnúmero\b/i.test(val) ||  // endereço
      /\d{5}-?\d{3}/.test(val) ||  // CEP
      /méier|botafogo|tijuca|barra|ipanema|copacabana|leblon|flamengo|gloria|catete|lapa|centro|norte shopping|nova améric/i.test(lower) ||
      /tatuapé|mooca|paulista|pinheiros|perdizes|lapa sp|jardins|vila olimpia/i.test(lower) ||
      /casashopping|iguatemi|eldorado|morumbi shopping|shopping sp|shopping rj/i.test(lower)
    );
  }

  // Labels legíveis sem bug de capitalização com português
  function toLabel(field: string): string {
    return field
      .replace(/asset_data\./g, "")
      .replace(/\./g, " › ")
      .replace(/_/g, " ")
      .split(" ")
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  // Campos seguros para highlights (whitelist por categoria)
  const SAFE_FIELD_PATTERNS = [
    "receita", "ebitda", "lucro", "faturamento", "revenue",
    "area", "leitos", "capacidade", "lojas", "andares", "m²", "hectares", "ha",
    "fundacao", "founding", "operacao", "historico",
    "processos", "pendencias", "licencas", "alvarás",
    "estrutura_fisica", "estrutura fisica", "metragem",
    "divida", "debt", "valor", "deal_value",
    "tipo_operacao", "tipo operacao", "deal_type",
    "setor", "sector",
    "buyer", "seller", "participante",
  ];
  function isSafeHighlight(field: string): boolean {
    const lower = field.toLowerCase();
    // Bloquear campos identificadores
    if (isBlind(field)) return false;
    // Bloquear campos de contexto competitivo que revelam localização
    if (/alinhamento|mercado.atendido|concorrente|competidor/i.test(lower)) return false;
    // Permitir apenas campos de categorias seguras
    return SAFE_FIELD_PATTERNS.some(p => lower.includes(p));
  }

  const highlights = (forjaResult.validated ?? [])
    .filter(v =>
      isSafeHighlight(v.field) &&
      v.value && v.value !== "—" &&
      v.value.length < 200 &&
      !valueRevealLocation(v.value)   // rejeita valores que identificam localização
    )
    .slice(0, 8)
    .map(v => ({ label: toLabel(v.field), value: v.value }));

  // Usa tese gerada pelo FORJA — fallback para Haiku se não existir (deals antigos)
  const teseInvestimento: string[] =
    Array.isArray(forjaResult.tese_investimento) && forjaResult.tese_investimento.length > 0
      ? forjaResult.tese_investimento
      : await gerarTeseInvestimento({
          sector: deal.sector ?? "",
          regiao: regiaoBlind,
          valor: Number(deal.deal_value ?? 0),
          narrativaPt: forjaResult.narrative_pt,
          dealContext: dealEstrutura || (deal.notes as string) || "",
        });

  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const baseUrl     = getBaseUrl(req);

  const html = buildTeaserHtml({
    code:        deal.code ?? deal_id.slice(0, 8),
    sector:      deal.sector ?? "Setor não informado",
    regiao:      regiaoBlind,
    valor:       Number(deal.deal_value ?? 0),
    dealType,
    dealEstrutura,
    forjaResult,
    teseInvestimento,
    highlights,
    generatedAt,
    baseUrl,
  });

  // Salvar histórico
  try {
    const history = Array.isArray(ad.teaser_cego_history)
      ? [...(ad.teaser_cego_history as unknown[]), { generated_at: new Date().toISOString() }]
      : [{ generated_at: new Date().toISOString() }];
    await db.from("ma_deals").update({
      asset_data: { ...ad, teaser_cego_history: history, teaser_cego_generated_at: new Date().toISOString() },
    }).eq("id", deal_id);
  } catch { /* não bloquear */ }

  // Gate Brand & Grammar Guardian — corrige cores legadas/travessão/Bloxs/emoji
  // automaticamente; bloqueia se logo/DM Sans/navy estiverem ausentes (não deveria
  // acontecer neste template, mas é a rede de segurança antes de expor a mercado).
  const gate = auditHtml(html);
  if (gate.blocking.length > 0) {
    console.error("[gerar-teaser-cego] Brand Guardian bloqueou o documento:", gate.blocking);
    return NextResponse.json(
      { error: "Gate de marca bloqueou o teaser cego", violations: gate.blocking.map((v) => v.message) },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true, html: gate.corrected, code: deal.code });
}
