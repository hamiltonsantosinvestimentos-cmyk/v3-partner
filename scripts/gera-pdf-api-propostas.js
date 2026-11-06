const fs = require("fs");
// Gera o PDF premium do guia da API (identidade V3). Uso: node scripts/gera-pdf-api-propostas.js <saida.html>
// e depois imprimir o HTML em PDF com o Chrome headless (ver comentário no fim).
const raiz = require("path").resolve(__dirname, "..");
const src = fs.readFileSync(`${raiz}/docs/integracao/api-propostas-credito.html`, "utf8");
let main = src.slice(src.indexOf("<main>") + 6, src.indexOf("</main>"));
main = main.replace(/<footer>[\s\S]*?<\/footer>/, "");
const logo = "data:image/jpeg;base64," + fs.readFileSync(`${raiz}/public/logo.jpg`).toString("base64");
const secoes = [...main.matchAll(/<section id="([^"]+)">\s*(?:<span class="eyebrow">[^<]*<\/span>\s*)?<h[12]>([^<]+)<\/h[12]>/g)]
  .map((m) => ({ id: m[1], titulo: m[2] })).filter((s) => s.id !== "visao");
const sumario = secoes.map((s) => `<li><span>${s.titulo}</span><i></i></li>`).join("");

const css = `
:root{--navy:#09081A;--base:#111F35;--card:#162744;--medio:#243A66;--ouro:#C9A84C;--ouro2:#E8C97A;--cream:#F0ECE4;--muted:#9AABC0;--mono:Consolas,"Cascadia Mono",ui-monospace,monospace}
@page{size:A4;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
html,body{margin:0;background:var(--navy);color:var(--muted);font:400 9.6pt/1.62 "DM Sans",Arial,sans-serif}
.fundo{position:fixed;inset:0;background:var(--navy);z-index:-2}
.fundo::before{content:"";position:absolute;inset:0;background:radial-gradient(120% 60% at 100% 0%,rgba(36,58,102,.55),transparent 60%)}
.rodape{position:fixed;left:16mm;right:16mm;bottom:8mm;display:flex;justify-content:space-between;align-items:center;font-size:7pt;letter-spacing:.14em;text-transform:uppercase;color:var(--muted);border-top:.4pt solid rgba(201,168,76,.45);padding-top:2.6mm;z-index:1}
.rodape b{color:var(--ouro);font-weight:700}
.topo{position:fixed;left:16mm;right:16mm;top:8mm;display:flex;justify-content:space-between;font-size:6.6pt;letter-spacing:.18em;text-transform:uppercase;color:rgba(201,168,76,.75);z-index:1}
.capa{position:relative;z-index:5;height:297mm;padding:22mm 18mm 20mm;background:linear-gradient(160deg,#0B0A20 0%,#111F35 55%,#162744 100%);display:flex;flex-direction:column;page-break-after:always;overflow:hidden}
.capa::after{content:"";position:absolute;right:-40mm;top:-40mm;width:150mm;height:150mm;border-radius:50%;border:.5pt solid rgba(201,168,76,.25)}
.capa::before{content:"";position:absolute;right:-20mm;top:-20mm;width:110mm;height:110mm;border-radius:50%;border:.5pt solid rgba(201,168,76,.15)}
.capa .marca{width:52mm;border-radius:3mm;border:.6pt solid rgba(201,168,76,.6);box-shadow:0 8mm 20mm rgba(0,0,0,.45)}
.capa .eyebrow{margin-top:34mm;font-size:8pt;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--ouro)}
.capa h1{margin:5mm 0 0;font-size:40pt;line-height:1.04;font-weight:700;color:var(--cream);letter-spacing:-.01em;max-width:150mm}
.capa h1 em{font-style:normal;color:var(--ouro2)}
.capa .sub{margin-top:7mm;max-width:132mm;font-size:12pt;line-height:1.55;color:#B8C4D3}
.capa .filete{margin-top:12mm;width:42mm;height:1.4pt;background:linear-gradient(90deg,var(--ouro),var(--ouro2),transparent)}
.capa .meta{margin-top:auto;display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;border-top:.5pt solid rgba(201,168,76,.35);padding-top:6mm}
.capa .meta div{font-size:7.2pt;letter-spacing:.16em;text-transform:uppercase;color:var(--muted)}
.capa .meta b{display:block;margin-top:1.5mm;font-size:10pt;letter-spacing:0;text-transform:none;color:var(--cream);font-weight:600}
.sumario{position:relative;z-index:5;height:297mm;padding:30mm 22mm;background:var(--navy);page-break-after:always}
.sumario .eyebrow{font-size:8pt;font-weight:700;letter-spacing:.28em;text-transform:uppercase;color:var(--ouro)}
.sumario h2{margin:4mm 0 12mm;font-size:26pt;color:var(--cream);font-weight:700}
.sumario ol{list-style:none;margin:0;padding:0;counter-reset:s}
.sumario li{counter-increment:s;display:flex;align-items:baseline;gap:5mm;padding:3.6mm 0;border-bottom:.4pt solid rgba(36,58,102,.9);font-size:12pt;color:var(--cream)}
.sumario li::before{content:counter(s,decimal-leading-zero);font-size:9pt;font-weight:700;color:var(--ouro);width:9mm;letter-spacing:.1em}
.sumario li i{flex:1}
.sumario .nota{margin-top:14mm;padding:5mm 6mm;border-left:1.5pt solid var(--ouro);background:rgba(22,39,68,.6);color:#C9D3DF;font-size:9.4pt;max-width:140mm}
table.paginas{width:100%;border-collapse:collapse}
table.paginas>thead td{height:20mm} table.paginas>tfoot td{height:22mm}
.conteudo{padding:0 16mm}
main{display:block}
section{margin:0 0 9mm;break-inside:auto}
#visao h1,#visao>.eyebrow{display:none}
section>h2{display:flex;align-items:center;gap:3.5mm;margin:0 0 4mm;padding-top:3mm;font-size:17pt;line-height:1.2;font-weight:700;color:var(--cream);break-after:avoid}
section>h2::before{content:"";width:6mm;height:1.4pt;background:var(--ouro)}
h3{margin:5mm 0 2mm;font-size:10.5pt;color:var(--ouro2);font-weight:600;break-after:avoid}
p{margin:0 0 3mm;max-width:none}
b,strong{color:var(--cream);font-weight:600}
a{color:var(--ouro2);text-decoration:none}
code{font-family:var(--mono);font-size:8.4pt;color:var(--ouro2);background:rgba(36,58,102,.55);padding:.3mm 1.4mm;border-radius:1mm}
pre{margin:2.5mm 0 3.5mm;background:#0D1729;border:.5pt solid #1E3358;border-left:1.6pt solid var(--ouro);border-radius:1.8mm;padding:3.6mm 4.2mm;font:7.9pt/1.55 var(--mono);color:#E6E1D6;white-space:pre-wrap;word-break:break-word;break-inside:avoid}
pre code{background:none;padding:0;color:inherit;font-size:inherit}
.k{color:var(--ouro2)}.s{color:#9FC9A4}.c{color:#7A8FA8}
.aviso{border:.6pt solid var(--ouro);background:linear-gradient(90deg,rgba(201,168,76,.14),rgba(201,168,76,.03));border-radius:2mm;padding:4mm 5mm;color:var(--cream);margin:2mm 0 4mm}
.aviso b{color:var(--ouro2)}
.fluxo{list-style:none;padding:0;margin:3mm 0 4mm;display:grid;grid-template-columns:repeat(4,1fr);gap:3mm;counter-reset:p}
.fluxo li{counter-increment:p;background:var(--base);border:.5pt solid var(--card);border-top:1.4pt solid var(--ouro);border-radius:1.8mm;padding:3.5mm;font-size:8.6pt;break-inside:avoid}
.fluxo li::before{content:"Passo " counter(p);display:block;font-size:6.8pt;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--ouro);margin-bottom:1.5mm}
.fluxo b{display:block;color:var(--cream);font-size:9.6pt;margin-bottom:1mm}
ul.lista,ol.lista{margin:1mm 0 3mm;padding-left:5mm}
ul.lista li,ol.lista li{margin:0 0 1.8mm}
ol.lista li::marker{color:var(--ouro);font-weight:700}
ul.lista li::marker{color:var(--ouro)}
.endpoint{border-top:.4pt solid var(--card);padding-top:3.5mm;margin-top:3.5mm}
.ep{display:flex;align-items:center;gap:2.5mm;font-family:var(--mono);font-size:9.4pt;color:var(--cream);margin-bottom:2mm;break-after:avoid}
.m{font:700 6.8pt "DM Sans";letter-spacing:.12em;padding:.9mm 2.2mm;border-radius:1mm;background:var(--medio);color:var(--cream)}
.m.post{background:var(--ouro);color:var(--navy)}
.tbl{border:.5pt solid var(--card);border-radius:1.8mm;overflow:hidden;margin:2mm 0 4mm}
.tbl table{width:100%;border-collapse:collapse;font-size:8.4pt}
.tbl th{text-align:left;font-size:6.6pt;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--ouro);background:#0D1729;padding:2.6mm 3mm}
.tbl td{padding:2.4mm 3mm;border-top:.4pt solid var(--card);vertical-align:top}
.tbl tr{break-inside:avoid}
.tbl td:first-child{color:var(--cream);font-weight:500}
.tbl tbody tr:nth-child(even) td{background:rgba(17,31,53,.55)}
.req{font-size:6.8pt;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--ouro)}
.opt{font-size:6.8pt;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.etapas{display:flex;flex-wrap:wrap;gap:2mm;margin:2mm 0 3mm}
.etapas span{font:600 7.6pt var(--mono);border:.5pt solid var(--medio);border-radius:10mm;padding:1mm 3mm;color:var(--cream)}
.etapas span.ok{border-color:#6FBF8E;color:#9FD9B2}.etapas span.fim{border-color:#C9786B;color:#E3A396}
.contra{position:relative;z-index:5;height:297mm;padding:0 22mm;background:linear-gradient(200deg,#0B0A20 0%,#111F35 60%,#162744 100%);display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;break-before:page}
.contra img{width:44mm;border-radius:3mm;border:.6pt solid rgba(201,168,76,.6)}
.contra .linha{width:30mm;height:1pt;background:var(--ouro);margin:10mm auto}
.contra p{color:#C9D3DF;font-size:9.6pt;max-width:130mm;margin:0 auto 2.5mm}
.contra .peq{font-size:7.6pt;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-top:8mm}
`;

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>API de Propostas de Crédito · V3 Partners</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&display=swap">
<style>${css}</style></head><body>
<div class="fundo"></div>
<div class="topo"><span>V3 Partners · Integração para desenvolvedores</span><span>Versão 1.1 · 11/2026</span></div>
<div class="rodape"><span><b>V3</b> Partners · API de Propostas de Crédito</span><span>app.v3partners.com.br/API</span></div>

<div class="capa">
  <img class="marca" src="${logo}" alt="V3 Partners">
  <div class="eyebrow">Guia de integração · Desenvolvedores</div>
  <h1>API de Propostas<br>de <em>Crédito</em></h1>
  <p class="sub">Conecte o sistema da sua empresa à Mesa de Crédito da V3: cadastre propostas, envie documentos e acompanhe cada etapa, com segurança de ponta a ponta.</p>
  <div class="filete"></div>
  <div class="meta">
    <div>Versão<b>1.1 · Novembro de 2026</b></div>
    <div>Endereço base<b>app.v3partners.com.br/api/v1</b></div>
    <div>Uso<b>Partner e seu desenvolvedor</b></div>
  </div>
</div>

<div class="sumario">
  <div class="eyebrow">Conteúdo</div>
  <h2>Sumário</h2>
  <ol>${sumario}</ol>
  <div class="nota">Disponível para os planos Partner PRO, Gold, Diamante e Enterprise. A chave de acesso é criada pelo partner na plataforma V3, no menu Integração por API, depois do aceite do Termo de Uso.</div>
</div>

<table class="paginas"><thead><tr><td></td></tr></thead><tfoot><tr><td></td></tr></tfoot><tbody><tr><td>
<div class="conteudo"><main>${main}</main></div>
</td></tr></tbody></table>

<div class="contra">
  <img src="${logo}" alt="V3 Partners">
  <div class="linha"></div>
  <p><b>V3 Partners Soluções Ltda.</b> · CNPJ 14.219.287/0001-50</p>
  <p>Rua Visconde de Pirajá, 414, sala 718 · Ipanema · Rio de Janeiro/RJ</p>
  <p>Dúvidas técnicas: fale com o seu contato na V3 informando o código da proposta e o horário da chamada.</p>
  <div class="peq">Documento para uso do partner e do seu desenvolvedor · Versão 1.1 · Novembro de 2026</div>
</div>
</body></html>`;
fs.writeFileSync(process.argv[2], html);
console.log("secoes:", secoes.map((s) => s.titulo).join(" | "));

// PDF: chrome --headless=new --no-pdf-header-footer --virtual-time-budget=10000 --print-to-pdf=docs/integracao/V3-Guia-API-Propostas.pdf file:///<saida.html>
