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
// HTML real. Não depende do ClickSign posicionar nada — o PDF que sobe pra
// assinatura é gerado por nós (htmlToPdfBase64), então a posição da "área de
// assinatura" de cada parte já vem definida no próprio documento.
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
</div>
</body>
</html>`;
}
