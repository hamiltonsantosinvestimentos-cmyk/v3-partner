import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { auditHtml } from "@/lib/brand-guardian-gate";

// Sprint 1, Fase 4 (18/09/2026), item 4.7: Teaser Cego para ativos da Bolsa
// (precatórios, direitos creditórios), equivalente ao já existente para M&A
// em app/api/ma/gerar-teaser-cego/route.ts. Mesma disciplina de blindagem de
// campo, mesmo gate de marca (auditHtml), mesmo formato de resposta (HTML
// pronto pra Ctrl+P, nunca PDF gerado no servidor). O identificador público
// já é o anonymous_id (código V3-PR/V3-DC/V3-BA), desenhado desde a
// governança de numeração pra nunca expor o cedente.

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function formatM(v: number | null | undefined): string {
  if (!v) return "N/D";
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toLocaleString("pt-BR")}`;
}

const ASSET_TYPE_LABELS: Record<string, string> = {
  precatorio: "Precatório",
  direito_creditorio: "Direito Creditório",
  ipi: "Crédito de IPI",
  icms: "Crédito de ICMS",
  outros: "Ativo Financeiro",
};

function getBaseUrl(req: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
}

function buildTeaserHtml(params: {
  code: string;
  assetTypeLabel: string;
  esfera: string | null;
  natureza: string | null;
  valorFace: number;
  desagio: number | null;
  prazoMeses: number | null;
  allowsTranching: boolean;
  trancheMinimo: number | null;
  generatedAt: string;
  baseUrl: string;
}): string {
  const { code, assetTypeLabel, esfera, natureza, valorFace, desagio, prazoMeses, allowsTranching, trancheMinimo, generatedAt, baseUrl } = params;

  const highlights = [
    esfera ? { label: "Esfera", value: esfera } : null,
    natureza ? { label: "Natureza", value: natureza } : null,
    desagio ? { label: "Deságio Pretendido", value: `${desagio}%` } : null,
    prazoMeses ? { label: "Prazo Estimado", value: `${prazoMeses} meses` } : null,
    allowsTranching ? { label: "Fracionamento", value: trancheMinimo ? `A partir de ${formatM(trancheMinimo)}` : "Aceita tranches" } : null,
  ].filter((h): h is { label: string; value: string } => !!h);

  const highlightCards = highlights.map(h =>
    `<div style="background:#162744;border:1px solid #243A66;border-radius:6px;padding:12px 14px;">
      <p style="margin:0 0 3px;font-size:8px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#9BAFC5;">${h.label}</p>
      <p style="margin:0;font-size:12px;font-weight:600;color:#F5F1E8;">${h.value}</p>
    </div>`).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Teaser Cego · ${assetTypeLabel} · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet"/>
<style>
  @page { size: A4 portrait; margin: 0; }
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'DM Sans', Arial, sans-serif; background: #09081A; color: #F5F1E8;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 28px 0; }
  .page { width: 794px; background: #09081A; margin: 0 auto 24px; box-shadow: 0 4px 40px rgba(0,0,0,.7); }
  .stripe { height: 4px; background: linear-gradient(to right,#09081A,#C9A84C,#E8C97A,#C9A84C,#09081A); }
  .no-print { display:block; text-align:center; padding:8px; font-size:10px; color:#9BAFC5; background:#162744; }
  @media print {
    .no-print { display:none!important; }
    html, body { background:#09081A!important; padding:0!important; -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .page { width:210mm!important; margin:0!important; box-shadow:none!important; }
  }
</style>
</head>
<body>
<div class="no-print">Ctrl+P, Salvar como PDF, sem margens, gráficos de fundo ativado</div>
<div class="page">
<div class="stripe"></div>

<div style="background:#09081A;padding:52px 52px 44px;border-bottom:1px solid #162744;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:52px;">
    <img src="${baseUrl}/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:38px;width:auto;"/>
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9BAFC5;border:1px solid #243A66;padding:5px 12px;border-radius:2px;">Documento Cego</div>
      <div style="font-size:8px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;border:1px solid rgba(201,168,76,0.4);padding:5px 12px;border-radius:2px;">NDA Requerido</div>
    </div>
  </div>

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
    <div style="width:28px;height:2px;background:#C9A84C;"></div>
    <span style="font-size:9px;font-weight:700;letter-spacing:4px;text-transform:uppercase;color:#C9A84C;">Oportunidade Bolsa de Ativos, V3 Partners</span>
  </div>

  <h1 style="font-size:44px;font-weight:800;line-height:1.05;letter-spacing:-1px;color:#F5F1E8;margin-bottom:8px;">
    Aquisição de<br/><span style="color:#C9A84C;">${assetTypeLabel}</span>
  </h1>

  <p style="font-size:13px;color:#9BAFC5;margin-top:16px;">Valor de face: <strong style="color:#F5F1E8;">${formatM(valorFace)}</strong></p>
</div>

<div style="padding:40px 52px;">
  <p style="font-size:9px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;margin-bottom:16px;">Destaques da Operação</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:32px;">
    ${highlightCards || `<p style="font-size:11px;color:#9BAFC5;">Detalhes completos disponíveis mediante NDA.</p>`}
  </div>

  <p style="font-size:11px;color:#9BAFC5;line-height:1.7;margin-bottom:24px;">
    A V3 Partners atua como estruturadora e balcão de negócios desta operação, na qualidade de intermediária entre as partes, sem revelar a identidade do cedente/credor originário nesta fase preliminar. Interessados em avançar devem firmar Acordo de Não Divulgação e Não Circunvenção (NCNDA) antes de qualquer detalhamento adicional.
  </p>

  <div style="border-top:1px solid #243A66;padding-top:20px;display:flex;justify-content:space-between;align-items:center;">
    <span style="font-size:9px;color:#9BAFC5;">Protocolo ${code} · ${generatedAt}</span>
    <span style="font-size:9px;color:#9BAFC5;">V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50</span>
  </div>
</div>
</div>
</body>
</html>`;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const svc_ = svc();
  const { data: profile } = await svc_.from("profiles").select("role").eq("id", user.id).single();
  if (!["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { id } = await params;

  const { data: listing, error } = await svc_
    .from("cm_asset_listings")
    .select("id, anonymous_id, asset_type, esfera, natureza, valor_face, desagio_pretendido, prazo_estimado_meses, allows_tranching, tranche_valor_minimo")
    .eq("id", id)
    .single();

  if (error || !listing) return NextResponse.json({ error: "Ativo não encontrado" }, { status: 404 });
  if (!listing.anonymous_id) return NextResponse.json({ error: "Ativo ainda não tem código V3 emitido" }, { status: 422 });

  const generatedAt = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const baseUrl = getBaseUrl(req);

  const html = buildTeaserHtml({
    code: listing.anonymous_id,
    assetTypeLabel: ASSET_TYPE_LABELS[listing.asset_type as string] ?? "Ativo Financeiro",
    esfera: listing.esfera,
    natureza: listing.natureza,
    valorFace: Number(listing.valor_face ?? 0),
    desagio: listing.desagio_pretendido,
    prazoMeses: listing.prazo_estimado_meses,
    allowsTranching: !!listing.allows_tranching,
    trancheMinimo: listing.tranche_valor_minimo,
    generatedAt,
    baseUrl,
  });

  const gate = auditHtml(html);
  if (gate.blocking.length > 0) {
    return NextResponse.json(
      { error: "Gate de marca bloqueou o teaser cego", violations: gate.blocking.map((v) => v.message) },
      { status: 422 }
    );
  }

  // Texto de divulgação para WhatsApp (wa.me manual, nunca disparo automático,
  // mesmo padrão já usado no resto do sistema), com o número do Deal embutido
  // para permitir correlacionar qualquer resposta de interesse que volte.
  const whatsappText =
    `Oportunidade V3 Partners, Deal ${listing.anonymous_id}: ` +
    `${ASSET_TYPE_LABELS[listing.asset_type as string] ?? "Ativo"} de ${formatM(Number(listing.valor_face ?? 0))}` +
    (listing.desagio_pretendido ? `, deságio de ${listing.desagio_pretendido}%` : "") +
    `. Documento completo (blindado, NDA requerido) disponível mediante interesse. ` +
    `Responda citando o Deal ${listing.anonymous_id} para prosseguirmos.`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappText)}`;

  return NextResponse.json({ ok: true, html: gate.corrected, code: listing.anonymous_id, whatsapp_text: whatsappText, whatsapp_url: whatsappUrl });
}
