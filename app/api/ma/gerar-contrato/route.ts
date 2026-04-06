import { NextRequest, NextResponse } from "next/server";
import { DEMO_DEALS } from "@/lib/demo-data";

const IS_DEMO =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("SEU_PROJETO");

const FONT = `https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap`;

const CSS_BASE = `
  @import url('${FONT}');
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'DM Sans', Arial, sans-serif;
    background: white;
    color: #1a1a1a;
    max-width: 860px;
    margin: 0 auto;
    padding: 60px 56px;
  }
  .v3-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 40px;
    padding-bottom: 20px;
    border-bottom: 2px solid #C9A84C;
  }
  .v3-header-left { display: flex; align-items: center; gap: 14px; }
  .v3-logo-box {
    width: 44px; height: 44px;
    background: linear-gradient(135deg, #C9A84C, #E8C97A);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: #09081A;
    flex-shrink: 0;
  }
  .v3-header-company { display: flex; flex-direction: column; }
  .v3-company-name { font-size: 15px; font-weight: 700; color: #09081A; }
  .v3-company-cnpj { font-size: 10px; color: #666; margin-top: 1px; }
  .v3-header-meta { text-align: right; }
  .v3-header-meta .doc-type { font-size: 9px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #C9A84C; }
  .v3-header-meta .doc-date { font-size: 11px; color: #666; margin-top: 4px; }
  h1 { font-size: 20px; font-weight: 700; text-align: center; margin-bottom: 8px; color: #09081A; }
  .numero-contrato { text-align: center; font-size: 12px; color: #666; margin-bottom: 32px; }
  .partes-section { margin-bottom: 28px; }
  .partes-section h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #C9A84C; margin-bottom: 12px; }
  .parte-bloco { background: #f9f9f7; border-left: 3px solid #C9A84C; padding: 12px 16px; margin-bottom: 10px; border-radius: 0 6px 6px 0; }
  .parte-bloco .parte-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #888; margin-bottom: 4px; }
  .parte-bloco .parte-nome { font-size: 13px; font-weight: 600; color: #1a1a1a; }
  .parte-bloco .parte-info { font-size: 11px; color: #555; margin-top: 2px; }
  .clausula { margin-bottom: 20px; }
  .clausula h3 { font-size: 13px; font-weight: 700; text-transform: uppercase; margin-bottom: 8px; color: #09081A; }
  .clausula p { font-size: 12px; line-height: 1.8; color: #333; text-align: justify; }
  .clausula ul { font-size: 12px; line-height: 1.8; color: #333; padding-left: 18px; margin-top: 6px; }
  .clausula ul li { margin-bottom: 4px; }
  .divider { height: 1px; background: #e0e0e0; margin: 24px 0; }
  .assinaturas { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 60px; }
  .assinatura-bloco { text-align: center; }
  .assinatura-linha { border-top: 1px solid #333; padding-top: 8px; margin-top: 48px; }
  .assinatura-nome { font-size: 12px; font-weight: 600; color: #1a1a1a; }
  .assinatura-cargo { font-size: 11px; color: #666; }
  .testemunhas { display: grid; grid-template-columns: 1fr 1fr; gap: 48px; margin-top: 40px; }
  .local-data { text-align: center; font-size: 12px; color: #555; margin-top: 36px; }
  .v3-footer {
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
    text-align: center;
    font-size: 10px;
    color: #999;
    line-height: 1.6;
  }
  .confidencial-banner {
    background: #fff8e7;
    border: 1px solid #C9A84C;
    border-radius: 6px;
    padding: 10px 16px;
    margin-bottom: 28px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #7a5c00;
    letter-spacing: 1px;
    text-transform: uppercase;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 40px 44px; }
  }
`;

function dataExtenso(d: Date): string {
  const meses = [
    "janeiro","fevereiro","março","abril","maio","junho",
    "julho","agosto","setembro","outubro","novembro","dezembro"
  ];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
}

function buildNDA(deal: (typeof DEMO_DEALS)[0], lang: string): string {
  const hoje = new Date();
  const numeroContrato = `NDA-${deal.code}-${Date.now().toString().slice(-6)}`;
  const dataStr = lang === "en"
    ? hoje.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : dataExtenso(hoje);
  const contato = (deal.asset_data as Record<string, unknown>).contato as Record<string,string> | undefined;

  const parteB_nome = contato?.nome ?? "Representante Legal do Ativo";
  const parteB_empresa = deal.target_company;
  const parteB_doc = contato?.cpf_cnpj ?? "CPF/CNPJ a identificar";
  const parteB_cargo = contato?.cargo ?? "Representante Legal";
  const parteB_email = contato?.email ?? "—";

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NDA — ${deal.target_company}</title>
  <link href="${FONT}" rel="stylesheet" />
  <style>${CSS_BASE}</style>
</head>
<body>
  <div class="v3-header">
    <div class="v3-header-left">
      <div class="v3-logo-box">V3</div>
      <div class="v3-header-company">
        <span class="v3-company-name">V3 Partners Soluções Ltda</span>
        <span class="v3-company-cnpj">CNPJ 14.219.287/0001-50</span>
      </div>
    </div>
    <div class="v3-header-meta">
      <div class="doc-type">Documento Legal</div>
      <div class="doc-date">${dataStr}</div>
    </div>
  </div>

  <div class="confidencial-banner">Confidencial — Uso Restrito às Partes Signatárias</div>

  <h1>ACORDO DE NÃO DIVULGAÇÃO (NDA)</h1>
  <div class="numero-contrato">Nº ${numeroContrato} · Referência: ${deal.asset_data.processo_v3 ?? deal.code}</div>

  <div class="partes-section">
    <h2>Identificação das Partes</h2>
    <div class="parte-bloco">
      <div class="parte-label">Parte Divulgadora (Mandatária)</div>
      <div class="parte-nome">V3 Partners Soluções Ltda</div>
      <div class="parte-info">CNPJ 14.219.287/0001-50 · Representada por: João Lemos Netto</div>
      <div class="parte-info">Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ</div>
    </div>
    <div class="parte-bloco">
      <div class="parte-label">Parte Receptora</div>
      <div class="parte-nome">${parteB_empresa}</div>
      <div class="parte-info">Doc.: ${parteB_doc} · Representado(a) por: ${parteB_nome} — ${parteB_cargo}</div>
      ${parteB_email !== "—" ? `<div class="parte-info">E-mail: ${parteB_email}</div>` : ""}
    </div>
  </div>

  <div class="divider"></div>

  <div class="clausula">
    <h3>Cláusula 1 — Objeto</h3>
    <p>As Partes acordam manter em estrito sigilo todas as informações referentes ao ativo <strong>${deal.target_company}</strong>, incluindo dados financeiros, operacionais, estratégicos, jurídicos e quaisquer outros dados disponibilizados no contexto da análise e negociação da operação de M&A identificada como <strong>${deal.title}</strong> (doravante "Operação"), com valor estimado de transação de <strong>${deal.deal_value >= 1e9 ? "R$ " + (deal.deal_value/1e9).toFixed(1) + " B" : deal.deal_value >= 1e6 ? "R$ " + (deal.deal_value/1e6).toFixed(1) + " MM" : "R$ " + deal.deal_value.toLocaleString("pt-BR")}</strong>.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 2 — Confidencialidade</h3>
    <p>As Partes se comprometem a:</p>
    <ul>
      <li>Não divulgar, reproduzir, transmitir ou utilizar, direta ou indiretamente, as Informações Confidenciais para qualquer finalidade diversa da avaliação da Operação;</li>
      <li>Restringir o acesso às Informações Confidenciais exclusivamente às pessoas que necessitem conhecê-las para fins da avaliação da Operação, as quais deverão estar vinculadas por obrigações de sigilo equivalentes;</li>
      <li>Adotar medidas de segurança razoáveis para proteger as Informações Confidenciais contra acesso não autorizado;</li>
      <li>Notificar imediatamente a outra Parte em caso de divulgação não autorizada ou suspeita de violação deste Acordo.</li>
    </ul>
  </div>

  <div class="clausula">
    <h3>Cláusula 3 — Prazo</h3>
    <p>As obrigações de confidencialidade estabelecidas neste Acordo vigorarão pelo prazo de <strong>24 (vinte e quatro) meses</strong> contados da data de assinatura, independentemente do término da relação de negociação entre as Partes. Findo o prazo, a Parte Receptora deverá destruir ou devolver todos os materiais e documentos contendo Informações Confidenciais.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 4 — Penalidades</h3>
    <p>O descumprimento de quaisquer das obrigações previstas neste Acordo sujeitará a Parte infratora ao pagamento de multa compensatória equivalente a <strong>20% (vinte por cento) do valor estimado da Operação</strong>, sem prejuízo da reparação por perdas e danos comprovados, incluindo danos emergentes, lucros cessantes e danos reputacionais, nos termos do Código Civil Brasileiro (Lei 10.406/2002).</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 5 — Exceções</h3>
    <p>As obrigações de sigilo não se aplicam a informações que: (i) sejam ou tornem-se de domínio público por razão diversa de violação deste Acordo; (ii) já eram de conhecimento da Parte Receptora antes do recebimento; (iii) sejam desenvolvidas independentemente pela Parte Receptora sem uso das Informações Confidenciais; ou (iv) cuja divulgação seja exigida por lei, regulamento ou decisão judicial, desde que a Parte Receptora notifique previamente a Parte Divulgadora.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 6 — Jurisdição e Lei Aplicável</h3>
    <p>Este Acordo é regido pelas leis da República Federativa do Brasil. As Partes elegem o <strong>Foro da Comarca do Rio de Janeiro, Estado do Rio de Janeiro</strong>, como o único competente para dirimir qualquer controvérsia decorrente deste instrumento, com expressa renúncia a qualquer outro, por mais privilegiado que seja.</p>
  </div>

  <div class="local-data">
    Rio de Janeiro, ${dataStr}
  </div>

  <div class="assinaturas">
    <div class="assinatura-bloco">
      <div class="assinatura-linha">
        <div class="assinatura-nome">João Lemos Netto</div>
        <div class="assinatura-cargo">Head de Ativos / Sócio Fundador<br>V3 Partners Soluções Ltda</div>
      </div>
    </div>
    <div class="assinatura-bloco">
      <div class="assinatura-linha">
        <div class="assinatura-nome">${parteB_nome}</div>
        <div class="assinatura-cargo">${parteB_cargo}<br>${parteB_empresa}</div>
      </div>
    </div>
  </div>

  <div class="v3-footer">
    V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br>
    Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ · v3partners.com.br
  </div>
</body>
</html>`;
}

function buildMandato(deal: (typeof DEMO_DEALS)[0], lang: string): string {
  const hoje = new Date();
  const numeroContrato = `MND-${deal.code}-${Date.now().toString().slice(-6)}`;
  const dataStr = lang === "en"
    ? hoje.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
    : dataExtenso(hoje);
  const contato = (deal.asset_data as Record<string, unknown>).contato as Record<string,string> | undefined;

  const parteB_nome = contato?.nome ?? "Representante Legal do Ativo";
  const parteB_empresa = deal.target_company;
  const parteB_doc = contato?.cpf_cnpj ?? "CPF/CNPJ a identificar";
  const parteB_cargo = contato?.cargo ?? "Representante Legal";
  const parteB_email = contato?.email ?? "—";

  const valorDeal = deal.deal_value >= 1e9
    ? "R$ " + (deal.deal_value/1e9).toFixed(1) + " B"
    : deal.deal_value >= 1e6
      ? "R$ " + (deal.deal_value/1e6).toFixed(1) + " MM"
      : "R$ " + deal.deal_value.toLocaleString("pt-BR");

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mandato M&A — ${deal.target_company}</title>
  <link href="${FONT}" rel="stylesheet" />
  <style>${CSS_BASE}</style>
</head>
<body>
  <div class="v3-header">
    <div class="v3-header-left">
      <div class="v3-logo-box">V3</div>
      <div class="v3-header-company">
        <span class="v3-company-name">V3 Partners Soluções Ltda</span>
        <span class="v3-company-cnpj">CNPJ 14.219.287/0001-50</span>
      </div>
    </div>
    <div class="v3-header-meta">
      <div class="doc-type">Documento Legal</div>
      <div class="doc-date">${dataStr}</div>
    </div>
  </div>

  <div class="confidencial-banner">Confidencial — Uso Restrito às Partes Signatárias</div>

  <h1>CONTRATO DE MANDATO M&A</h1>
  <div class="numero-contrato">Nº ${numeroContrato} · Referência: ${deal.asset_data.processo_v3 ?? deal.code}</div>

  <div class="partes-section">
    <h2>Identificação das Partes</h2>
    <div class="parte-bloco">
      <div class="parte-label">Mandatária (Assessora Financeira)</div>
      <div class="parte-nome">V3 Partners Soluções Ltda</div>
      <div class="parte-info">CNPJ 14.219.287/0001-50 · Representada por: João Lemos Netto — Head de Ativos</div>
      <div class="parte-info">Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ</div>
    </div>
    <div class="parte-bloco">
      <div class="parte-label">Mandante (Contratante)</div>
      <div class="parte-nome">${parteB_empresa}</div>
      <div class="parte-info">Doc.: ${parteB_doc} · Representado(a) por: ${parteB_nome} — ${parteB_cargo}</div>
      ${parteB_email !== "—" ? `<div class="parte-info">E-mail: ${parteB_email}</div>` : ""}
    </div>
  </div>

  <div class="divider"></div>

  <div class="clausula">
    <h3>Cláusula 1 — Objeto e Mandato</h3>
    <p>A V3 Partners Soluções Ltda atua como mandatária exclusiva para estruturar e intermediar a transação referente ao ativo <strong>${deal.target_company}</strong>, identificada como <strong>${deal.title}</strong> (doravante "Operação"), com valor estimado de <strong>${valorDeal}</strong>. O mandato compreende a identificação e abordagem de potenciais compradores/investidores, estruturação financeira da operação, coordenação de due diligence, negociação assistida e acompanhamento até o fechamento (closing).</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 2 — Exclusividade</h3>
    <p>O presente Contrato de Mandato é <strong>exclusivo pelo prazo de 180 (cento e oitenta) dias</strong> corridos contados da data de assinatura. Durante este período, o Mandante compromete-se a não contratar, direta ou indiretamente, outros assessores financeiros ou intermediários para a Operação objeto deste instrumento, nem a negociar diretamente com qualquer parte apresentada pela V3 Partners sem a sua anuência.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 3 — Honorários e Success Fee</h3>
    <p>Os honorários da V3 Partners consistem em uma <strong>taxa de sucesso (success fee) de __% (____________ por cento)</strong> sobre o valor total da transação efetivamente concluída, incluindo todos os componentes de preço, earnouts e benefícios adicionais acordados entre as partes da Operação. O success fee será devido e exigível na data do fechamento (closing), mediante comprovação da transferência dos valores da Operação. Não haverá cobrança de retainer ou taxa de entrada.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 4 — Confidencialidade</h3>
    <p>As Partes se comprometem a manter em sigilo todas as informações trocadas no âmbito deste Contrato, aplicando-se, no que couber, os termos e condições do Acordo de Não Divulgação (NDA) celebrado entre as Partes. As obrigações de confidencialidade persistem por 24 (vinte e quatro) meses após o término deste instrumento, independentemente do motivo de encerramento.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 5 — Rescisão</h3>
    <p>O presente Contrato poderá ser rescindido por qualquer das Partes mediante notificação escrita com antecedência mínima de 30 (trinta) dias. Em caso de rescisão pelo Mandante durante o período de exclusividade, sem justa causa, será devida à V3 Partners uma multa compensatória de <strong>2% (dois por cento) do valor estimado da Operação</strong> a título de remuneração mínima. Em caso de conclusão da Operação com parte apresentada pela V3 Partners no prazo de 12 meses após o término deste Contrato, o success fee será integralmente devido.</p>
  </div>

  <div class="clausula">
    <h3>Cláusula 6 — Lei Aplicável e Foro</h3>
    <p>Este Contrato é regido pelas leis da República Federativa do Brasil. As Partes elegem o <strong>Foro da Comarca do Rio de Janeiro, Estado do Rio de Janeiro</strong>, como o único competente para dirimir qualquer litígio decorrente ou relacionado a este instrumento, com expressa renúncia a qualquer outro, por mais privilegiado que seja.</p>
  </div>

  <div class="local-data">
    Rio de Janeiro, ${dataStr}
  </div>

  <div class="assinaturas">
    <div class="assinatura-bloco">
      <div class="assinatura-linha">
        <div class="assinatura-nome">João Lemos Netto</div>
        <div class="assinatura-cargo">Head de Ativos / Sócio Fundador<br>V3 Partners Soluções Ltda</div>
      </div>
    </div>
    <div class="assinatura-bloco">
      <div class="assinatura-linha">
        <div class="assinatura-nome">${parteB_nome}</div>
        <div class="assinatura-cargo">${parteB_cargo}<br>${parteB_empresa}</div>
      </div>
    </div>
  </div>

  <div class="testemunhas">
    <div class="assinatura-bloco">
      <div class="assinatura-linha">
        <div class="assinatura-nome">Testemunha 1</div>
        <div class="assinatura-cargo">Nome: ______________________________<br>CPF: _______________________________</div>
      </div>
    </div>
    <div class="assinatura-bloco">
      <div class="assinatura-linha">
        <div class="assinatura-nome">Testemunha 2</div>
        <div class="assinatura-cargo">Nome: ______________________________<br>CPF: _______________________________</div>
      </div>
    </div>
  </div>

  <div class="v3-footer">
    V3 Partners Soluções Ltda · CNPJ 14.219.287/0001-50<br>
    Rua Visconde de Pirajá, 414, Sala 718 — Ipanema, Rio de Janeiro, RJ · v3partners.com.br
  </div>
</body>
</html>`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dealId = searchParams.get("dealId");
  const tipo = searchParams.get("tipo") ?? "nda";
  const lang = searchParams.get("lang") ?? "pt-br";

  if (!dealId) {
    return NextResponse.json({ error: "dealId obrigatório" }, { status: 400 });
  }

  let deal: (typeof DEMO_DEALS)[0] | null = null;

  if (IS_DEMO) {
    deal = DEMO_DEALS.find((d) => d.id === dealId || d.code === dealId) ?? null;
  } else {
    // Produção: busca no Supabase
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("ma_deals")
        .select("*")
        .eq("id", dealId)
        .single();
      if (error || !data) {
        return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
      }
      deal = data as unknown as (typeof DEMO_DEALS)[0];
    } catch {
      return NextResponse.json({ error: "Erro ao buscar deal" }, { status: 500 });
    }
  }

  if (!deal) {
    return NextResponse.json({ error: "Deal não encontrado" }, { status: 404 });
  }

  let html: string;
  if (tipo === "mandato") {
    html = buildMandato(deal, lang);
  } else {
    html = buildNDA(deal, lang);
  }

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
