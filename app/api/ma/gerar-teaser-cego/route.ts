import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

export const maxDuration = 30;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

type ValidatedField = { field: string; value: string; note?: string };
type ForjaResult = {
  score: number;
  validated: ValidatedField[];
  narrative_pt: string;
  narrative_en: string;
  recommendation: string;
  recommendation_note: string;
};

// Campos que identificam a empresa — nunca exibidos no teaser cego
const BLIND_FIELDS = new Set([
  "id", "code", "target_company", "asset_data.contato.nome",
  "asset_data.contato.email", "asset_data.contato.telefone",
  "location", "asset_data.cnpj", "website_url", "linkedin", "instagram",
]);

function isBlind(field: string): boolean {
  return BLIND_FIELDS.has(field) ||
    /contato|cnpj|email|telefone|instagram|linkedin|website|id$|code$/.test(field.toLowerCase());
}

function formatM(v: number | null | undefined): string {
  if (!v) return "—";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

function buildTeaserHtml(params: {
  code: string;
  sector: string;
  regiao: string;
  valor: number;
  forjaResult: ForjaResult;
  dealType?: string;
  highlights: { label: string; value: string }[];
  generatedAt: string;
}): string {
  const { code, sector, regiao, valor, forjaResult, dealType, highlights, generatedAt } = params;

  const REC_COLOR: Record<string, string> = {
    APROVADO: "#10B981", APROVADO_COM_RESSALVAS: "#F59E0B",
    PENDENTE: "#F97316", BLOQUEADO: "#EF4444",
  };
  const recColor = REC_COLOR[forjaResult.recommendation] ?? "#7A8FA8";

  const highlightRows = highlights
    .map(h => `
      <tr>
        <td style="padding:8px 12px;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#7A8FA8;width:38%;border-bottom:1px solid #162744;">${h.label}</td>
        <td style="padding:8px 12px;font-size:11px;color:#F0ECE4;font-weight:500;border-bottom:1px solid #162744;">${h.value}</td>
      </tr>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Teaser Cego — ${code} · V3 Partners</title>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
  <style>
    @page { size: A4 portrait; margin: 0; }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F0ECE4;
           -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 32px 0; }
    .page { width: 794px; min-height: 1123px; background: #111F35; margin: 0 auto 24px;
            box-shadow: 0 4px 40px rgba(0,0,0,0.7); position: relative; overflow: hidden; }
    .stripe { height: 4px; background: linear-gradient(to right,#09081A,#C9A84C,#E8C97A,#C9A84C,#09081A); }

    /* Cover */
    .cover { background: #09081A; padding: 56px 52px 48px; min-height: 460px; display: flex; flex-direction: column; justify-content: space-between; border-bottom: 1px solid #162744; }
    .cover-top { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 48px; }
    .cover-badge { font-size: 8px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #C9A84C; border: 1px solid rgba(201,168,76,0.4); padding: 5px 12px; border-radius: 2px; }
    .cover-title { font-size: 46px; font-weight: 800; line-height: 1.05; letter-spacing: -1px; color: #F0ECE4; margin-bottom: 16px; }
    .cover-title span { color: #C9A84C; }
    .cover-meta { display: flex; gap: 32px; flex-wrap: wrap; }
    .cover-meta-item { display: flex; flex-direction: column; gap: 3px; }
    .cover-meta-label { font-size: 8px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #7A8FA8; }
    .cover-meta-value { font-size: 16px; font-weight: 700; color: #F0ECE4; }
    .cover-meta-value.gold { color: #C9A84C; }
    .cover-footer { display: flex; align-items: center; justify-content: space-between; padding-top: 32px; border-top: 1px solid #162744; margin-top: 40px; }
    .cover-nda { background: rgba(201,168,76,0.08); border: 1px solid rgba(201,168,76,0.3); border-radius: 4px; padding: 8px 16px; }
    .cover-nda p { font-size: 8px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #C9A84C; }

    /* Body sections */
    .body { padding: 24px 32px 32px; }
    .section { margin-bottom: 20px; }
    .section-label { font-size: 7px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; color: #C9A84C; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .section-label::after { content: ''; flex: 1; height: 1px; background: rgba(201,168,76,0.2); }
    .card { background: #162744; border: 1px solid #243A66; border-radius: 6px; overflow: hidden; margin-bottom: 14px; }
    .narrative { font-size: 10px; color: #C4CDD8; line-height: 1.8; border-left: 3px solid rgba(201,168,76,0.4); padding: 14px 16px; background: rgba(9,8,26,0.4); border-radius: 0 6px 6px 0; }
    table.data { width: 100%; border-collapse: collapse; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    .blind-note { background: rgba(9,8,26,0.6); border: 1px solid #243A66; border-radius: 4px; padding: 10px 14px; font-size: 8px; color: #7A8FA8; line-height: 1.6; display: flex; align-items: flex-start; gap: 8px; }
    .blind-icon { color: #C9A84C; font-size: 14px; flex-shrink: 0; }

    /* CTA */
    .cta-box { background: linear-gradient(135deg,#162744,#0F1E35); border: 1px solid rgba(201,168,76,0.3); border-radius: 8px; padding: 20px 24px; text-align: center; margin-top: 20px; }
    .cta-title { font-size: 13px; font-weight: 700; color: #F0ECE4; margin-bottom: 6px; }
    .cta-sub { font-size: 9px; color: #7A8FA8; margin-bottom: 14px; }
    .cta-email { font-size: 11px; font-weight: 700; color: #C9A84C; letter-spacing: 1px; }

    /* Footer */
    .footer { background: #09081A; border-top: 1px solid rgba(201,168,76,0.15); padding: 10px 32px; display: flex; justify-content: space-between; align-items: center; }
    .footer-l { font-size: 7px; color: #7A8FA8; line-height: 1.6; }
    .footer-r { font-size: 7px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: rgba(201,168,76,0.4); }

    .no-print { display: block; text-align: center; padding: 8px; font-size: 10px; color: #7A8FA8; background: #162744; }
    @media print {
      .no-print { display: none !important; }
      html, body { background: #09081A !important; padding: 0 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .page { width: 210mm !important; min-height: 297mm !important; margin: 0 !important; box-shadow: none !important; page-break-after: always; }
    }
  </style>
</head>
<body>

<div class="no-print">Para salvar como PDF: Ctrl+P → Salvar como PDF → Sem margens · Gráficos de fundo ativado</div>

<div class="page">
  <div class="stripe"></div>

  <!-- CAPA -->
  <div class="cover">
    <div>
      <div class="cover-top">
        <img src="/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:36px;width:auto;"/>
        <div class="cover-badge">Teaser Cego · Confidencial</div>
      </div>

      <div class="cover-title">Oportunidade<br/><span>${sector}</span></div>

      <div class="cover-meta">
        <div class="cover-meta-item">
          <span class="cover-meta-label">Valor da Operação</span>
          <span class="cover-meta-value gold">${formatM(valor)}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Setor</span>
          <span class="cover-meta-value">${sector}</span>
        </div>
        <div class="cover-meta-item">
          <span class="cover-meta-label">Região</span>
          <span class="cover-meta-value">${regiao}</span>
        </div>
        ${dealType ? `<div class="cover-meta-item">
          <span class="cover-meta-label">Tipo</span>
          <span class="cover-meta-value">${dealType}</span>
        </div>` : ""}
      </div>
    </div>

    <div>
      <div class="cover-nda">
        <p>Informações confidenciais. Divulgação condicionada à assinatura de NDA com a V3 Partners.</p>
      </div>
      <div class="cover-footer">
        <div style="font-size:8px;color:#7A8FA8;">
          <span style="color:#C9A84C;font-weight:700;">V3 Partners</span> Soluções Ltda · Ipanema, Rio de Janeiro<br/>
          Referência: ${code} · Emitido em: ${generatedAt}
        </div>
        <div style="text-align:right;font-size:8px;color:#7A8FA8;">
          FORJA Score: <span style="color:${recColor};font-weight:700;">${forjaResult.score}/100</span><br/>
          <span style="color:${recColor};">${forjaResult.recommendation}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="body">

    <!-- Nota de confidencialidade -->
    <div class="blind-note" style="margin-bottom:20px;">
      <span class="blind-icon">⊘</span>
      <div>
        <strong style="color:#C9A84C;">Documento Cego</strong> — A identidade do ativo, razão social, endereço exato e contatos do vendedor foram omitidos. As informações completas são disponibilizadas após assinatura do NDA e qualificação do interesse pelo investidor.
      </div>
    </div>

    <!-- Descrição do Ativo -->
    <div class="section">
      <div class="section-label">Descrição do Ativo</div>
      <div class="narrative">${forjaResult.narrative_pt}</div>
    </div>

    <!-- Highlights Operacionais -->
    ${highlights.length > 0 ? `
    <div class="section">
      <div class="section-label">Highlights Operacionais</div>
      <div class="card">
        <table class="data">
          <tbody>${highlightRows}</tbody>
        </table>
      </div>
    </div>` : ""}

    <!-- Narrativa EN -->
    <div class="section">
      <div class="section-label">Investment Narrative (EN)</div>
      <div class="narrative">${forjaResult.narrative_en}</div>
    </div>

    <!-- CTA -->
    <div class="cta-box">
      <div class="cta-title">Interesse nesta oportunidade?</div>
      <div class="cta-sub">Entre em contato com a V3 Partners para acesso ao Information Memorandum completo e processo de qualificação.</div>
      <div class="cta-email">mesa@v3partners.com.br</div>
      <div style="font-size:8px;color:#7A8FA8;margin-top:6px;">v3partners.com.br · +55 21 98993-7178</div>
    </div>

  </div>

  <div class="footer">
    <div class="footer-l">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50 · Ipanema, Rio de Janeiro, RJ</div>
    <div class="footer-r">Confidencial · ${code}</div>
  </div>
</div>

</body>
</html>`;
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
      error: "Execute o FORJA primeiro para gerar a narrativa do ativo antes de criar o teaser cego."
    }, { status: 422 });
  }

  // Região cega: apenas UF/estado, nunca cidade
  const loc = (deal.location ?? "") as string;
  const regiaoBlind = (() => {
    const uf = loc.match(/\b([A-Z]{2})\b/) ?? loc.match(/\b(Rio de Janeiro|São Paulo|Minas Gerais|Bahia|Paraná|Rio Grande do Sul)\b/i);
    if (uf) return uf[0];
    const parts = loc.split(/[-·,]/);
    return parts[parts.length - 1]?.trim() ?? loc;
  })();

  // Highlights: campos validados não cegos
  const highlights = (forjaResult.validated ?? [])
    .filter(v => !isBlind(v.field))
    .filter(v => v.value && v.value !== "—" && v.value.length < 200)
    .slice(0, 12)
    .map(v => ({
      label: v.field.replace(/asset_data\./g, "").replace(/_/g, " ").replace(/\./g, " › "),
      value: v.value,
    }));

  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const html = buildTeaserHtml({
    code:        deal.code ?? deal_id.slice(0, 8),
    sector:      deal.sector ?? "—",
    regiao:      regiaoBlind,
    valor:       Number(deal.deal_value ?? 0),
    forjaResult,
    dealType:    (ad.tipo_oportunidade ?? ad.deal_type) as string | undefined,
    highlights,
    generatedAt,
  });

  // Salvar URL no asset_data para histórico
  try {
    const teaserHistory = Array.isArray(ad.teaser_cego_history)
      ? [...(ad.teaser_cego_history as unknown[]), { generated_at: new Date().toISOString(), type: "html" }]
      : [{ generated_at: new Date().toISOString(), type: "html" }];
    await db.from("ma_deals").update({
      asset_data: { ...ad, teaser_cego_history: teaserHistory, teaser_cego_generated_at: new Date().toISOString() },
    }).eq("id", deal_id);
  } catch { /* não bloquear */ }

  return NextResponse.json({ ok: true, html, code: deal.code });
}
