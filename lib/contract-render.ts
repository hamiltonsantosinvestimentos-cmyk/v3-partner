export function resolveContractVariables(template: string, data: Record<string, any>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();
    const value = data[trimmed];
    if (value === null || value === undefined) return `[${trimmed}]`;
    if (typeof value === "number") {
      return value.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    }
    return String(value);
  });
}

export interface ContractParty {
  role: string;
  name: string;
  doc?: string | null;
}

// Bloco de assinatura estilo manuscrito: uma linha por parte, com nome e
// CPF/CNPJ embaixo, igual a um contrato físico impresso. Reaproveita CSS
// (.parties/.party/.line) que já existia mas nunca era populado por nenhum
// HTML real. Continua sendo o caminho usado pelo PDF direto (htmlToPdfBase64)
// -- ainda é o fallback quando o .docx posicionado (abaixo) falha ou não se
// aplica. PRECISA receber `parties` preenchido em toda chamada de
// wrapContractInV3Html que gera documento destinado a assinatura — bug real
// encontrado e corrigido em 12/08/2026: 6 rotas chamavam wrapContractInV3Html
// sem o 3o argumento, e o PDF que o ClickSign buscava saía sem este bloco.
//
// CORREÇÃO de 11/09/2026 (BRIEF "Assinatura Posicionada"): a pesquisa de
// 12/08/2026 abaixo (mantida riscada, não apagada, pra não repetir o erro)
// concluiu que a API v3 não tinha NENHUM mecanismo de posicionamento. Isso
// estava incompleto -- não errado sobre o upload direto de PDF (esse de fato
// não tem posicionamento), mas a pesquisa não achou a API de Modelos/.docx
// (POST /api/v3/templates + tag {{~position_sign_ID}} no arquivo + requisito
// rubricate/manuscript com rubric_field), confirmada ao vivo em 11/09/2026
// contra a doc oficial (developers.clicksign.com/docs/copy-of-23-automação-
// com-modelos) e testada de ponta a ponta contra produção real (Modelo →
// Documento-do-Modelo → Signatário → Requisito rubricate aceito, e o texto
// acentuado íntegro conferido byte a byte no .docx convertido baixado de
// volta). Ver lib/contract-docx-render.ts e o branch `usePositioned` em
// lib/esignature/clicksign-provider.ts -- esse é o caminho novo (padrão),
// este bloco de linha/PDF é o fallback caso a geração do .docx falhe.
//
// Pesquisa original de 12/08/2026 (incompleta, ver correção acima): a API v3
// (envelopes) não tem NENHUM mecanismo programático de posicionamento de
// assinatura via upload direto de PDF, nem parâmetro de coordenada no
// payload de requirements/documents nesse caminho. O posicionamento manual
// ("Posicionar assinatura ou rubrica") na tela web do ClickSign também não
// se aplica aqui (esta integração ativa o envelope via API, nunca passa pela
// tela de envio manual).
function renderPartiesBlock(parties?: ContractParty[]): string {
  if (!parties || parties.length === 0) return "";
  const cards = parties
    .map((p) => `<div class="party"><div class="line"></div><div class="name">${p.name}</div>${p.doc ? `<div class="doc">${p.doc}</div>` : ""}</div>`)
    .join("");
  return `<div class="parties">${cards}</div>`;
}

export function wrapContractInV3Html(title: string, body: string, parties?: ContractParty[]): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>${title} · V3 Partners</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
body{font-family:'DM Sans',sans-serif;background:#09081A;color:#9BAFC5;padding:40px 60px;line-height:1.8;font-size:13px}
h1{font-size:20px;font-weight:700;color:#C9A84C;text-align:center;margin-bottom:8px}
h2{font-size:14px;font-weight:700;color:#C9A84C;margin:24px 0 8px;text-transform:uppercase;letter-spacing:.5px}
.header{text-align:center;margin-bottom:32px;padding-bottom:16px;border-bottom:2px solid #C9A84C}
.header img{height:40px;margin-bottom:8px}
.header p{font-size:11px;color:#9BAFC5}
p{margin-bottom:12px}
.parties{display:flex;flex-wrap:wrap;justify-content:center;gap:40px;margin-top:48px;padding-top:24px;border-top:1px solid #243A66}
.party{flex:1 1 200px;max-width:220px;text-align:center}
.party .line{width:200px;border-top:1px solid #9BAFC5;margin:40px auto 8px}
.party .name{font-weight:700;color:#F5F1E8;font-size:12px}
.party .doc{font-size:10px;color:#9BAFC5}
.footer{text-align:center;margin-top:48px;font-size:10px;color:#9BAFC5}
@media print{@page{size:A4;margin:13mm 14mm}body{background:#09081A!important;-webkit-print-color-adjust:exact!important}.header img{height:15mm!important}}
</style>
</head>
<body>
<div class="header">
<img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners">
<h1>${title}</h1>
<p>V3 Partners Soluções Ltda, CNPJ 14.219.287/0001-50</p>
</div>
${body}
${renderPartiesBlock(parties)}
<div class="footer">
<p>Documento gerado automaticamente pela plataforma V3 Partners em ${new Date().toLocaleDateString("pt-BR")}.</p>
<p>Este documento requer assinatura eletrônica para validade jurídica.</p>
<p>Em caso de dúvida ou necessidade de ajuste em qualquer cláusula antes da assinatura, entre em contato: WhatsApp +55 11 93763-9475 ou e-mail juridico@v3partners.com.br.</p>
</div>
</body>
</html>`;
}
