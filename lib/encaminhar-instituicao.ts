// Encaminhar proposta para Instituição por e-mail (BRIEF 2026-11-06_encaminhar-proposta-instituicao).
// Lógica pura e testável: contatos, partes de anexos, corpo do e-mail, situação e webhook (Svix).

export const UFS = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"] as const;

/** Limite de arquivos por e-mail (caixas de entrada aceitam de 20 a 25 MB). */
export const LIMITE_PARTE_BYTES = 20 * 1024 * 1024;
/** Arquivo sozinho acima disso não vai por e-mail. */
export const MAX_ARQUIVO_BYTES = 25 * 1024 * 1024;

export const RODAPE_CONFIDENCIALIDADE =
  "Este e-mail e seus anexos contêm dados pessoais e informações confidenciais, compartilhados exclusivamente para análise de crédito. Se você não é o destinatário, apague e avise suporte@v3partners.com.br.";

export function emailValido(e: string): boolean {
  const t = e.trim();
  return t.length <= 200 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
}

export type Contato = { id: string; nome: string | null; email: string; uf: string | null; cargo: string; telefone?: string | null; principal: boolean; ativo?: boolean };

/** Principal primeiro; depois Nacional (sem UF) e UFs em ordem; dentro, por nome em pt-BR. */
export function ordenarContatos<T extends Contato>(lista: T[]): T[] {
  return [...lista].sort((a, b) =>
    Number(b.principal) - Number(a.principal) ||
    (a.uf ?? "").localeCompare(b.uf ?? "", "pt-BR") ||
    (a.nome ?? a.email).localeCompare(b.nome ?? b.email, "pt-BR"));
}

/** Contatos marcados por padrão: os da UF da proposta e os Nacionais; se nenhum, o principal. */
export function contatosPadrao(lista: Contato[], ufProposta: string | null): string[] {
  const ativos = lista.filter((c) => c.ativo !== false);
  const porUf = ativos.filter((c) => c.uf === null || (ufProposta !== null && c.uf === ufProposta));
  if (porUf.length) return porUf.map((c) => c.id);
  const principal = ativos.find((c) => c.principal) ?? ativos[0];
  return principal ? [principal.id] : [];
}

type Meta = Record<string, unknown>;
type Imovel = { cidade?: string; estado?: string; zona?: string; padrao?: string; valor_medio?: number; avaliacao_tecnica?: { valores?: { valor_mercado?: number | null; valor_liquidez?: number | null } } };

/** UF da proposta: a do primeiro imóvel em garantia; sem imóvel, a do endereço do cliente. */
export function ufDaProposta(meta: Meta | null | undefined): string | null {
  const m = meta ?? {};
  const im = Array.isArray(m.imoveis) ? (m.imoveis as Imovel[]).find((i) => i?.estado) : undefined;
  const uf = (im?.estado ?? (m.endereco_uf as string | undefined) ?? "").toString().trim().toUpperCase();
  return /^[A-Z]{2}$/.test(uf) ? uf : null;
}

export type DocEnvio = { doc_id: string; nome_documento: string; file_name: string; storage_path: string; bytes: number };

/** Divide os documentos em partes de até `limite` bytes, na ordem dada. Arquivo grande demais fica de fora. */
export function dividirEmPartes<T extends { bytes: number }>(docs: T[], limite = LIMITE_PARTE_BYTES, maxArquivo = MAX_ARQUIVO_BYTES): { partes: T[][]; fora: T[] } {
  const partes: T[][] = [];
  const fora: T[] = [];
  let atual: T[] = [];
  let soma = 0;
  for (const d of docs) {
    if (d.bytes > maxArquivo) { fora.push(d); continue; }
    if (atual.length && soma + d.bytes > limite) { partes.push(atual); atual = []; soma = 0; }
    atual.push(d);
    soma += d.bytes;
  }
  if (atual.length) partes.push(atual);
  return { partes, fora };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type PropostaEnvio = { code: string; credit_line: string; requested_value: number | string | null; client_name: string | null; metadata: Meta | null };

export function montarAssunto(p: PropostaEnvio, parte = 1, total = 1): string {
  const valor = p.requested_value != null ? `, ${brl(Number(p.requested_value))}` : "";
  return `Proposta de crédito ${p.code}: ${p.credit_line}${valor}${total > 1 ? ` (parte ${parte} de ${total})` : ""}`;
}

/** Campos da proposta que vão no corpo. CPF/CNPJ, contato do cliente, RG, nascimento, partner e notas nunca entram. */
export function linhasDoCorpo(p: PropostaEnvio): Array<[string, string]> {
  const m = p.metadata ?? {};
  const linhas: Array<[string, string]> = [];
  const add = (k: string, v: unknown) => { if (v !== undefined && v !== null && String(v).trim() !== "") linhas.push([k, String(v)]); };
  add("Proposta", p.code);
  add("Linha de crédito", p.credit_line);
  if (p.requested_value != null) add("Valor solicitado", brl(Number(p.requested_value)));
  add("Prazo", m.prazo);
  add("Objetivo do crédito", m.finalidade);
  const pj = m.client_type === "PJ";
  add("Cliente", `${pj ? "Pessoa jurídica" : "Pessoa física"}: ${p.client_name ?? ""}`);
  const cid = [m.endereco_cidade, m.endereco_uf].filter(Boolean).join("/");
  add("Cidade do cliente", cid);
  if (pj && typeof m.faturamento_mensal === "number") add("Faturamento mensal", brl(m.faturamento_mensal));
  if (!pj && typeof m.renda_mensal === "number") add("Renda mensal", brl(m.renda_mensal));
  if (m.restricao_cliente === "SIM" || m.restricao_cliente === "NAO") add("Restrição de crédito", m.restricao_cliente === "SIM" ? "Sim" : "Não");
  const imoveis = Array.isArray(m.imoveis) ? (m.imoveis as Imovel[]) : [];
  const tipoGarantia = imoveis.length === 0 ? "Sem imóvel em garantia"
    : [...new Set(imoveis.map((i) => (i.zona === "RURAL" ? "Imóvel rural" : i.zona === "URBANO" ? "Imóvel urbano" : "Imóvel")))].join(" e ");
  add("Tipo da garantia", tipoGarantia);
  imoveis.forEach((i, n) => {
    const local = [i.cidade, i.estado].filter(Boolean).join("/");
    const tec = i.avaliacao_tecnica?.valores;
    const aval = typeof tec?.valor_mercado === "number"
      ? `${brl(tec.valor_mercado)} (avaliação técnica V3${typeof tec.valor_liquidez === "number" ? `; valor de garantia ${brl(tec.valor_liquidez)}` : ""})`
      : typeof i.valor_medio === "number" ? `${brl(i.valor_medio)} (estimado)` : "";
    const desc = [local, i.zona === "RURAL" ? "rural" : i.zona === "URBANO" ? "urbano" : null, i.padrao ? `padrão ${i.padrao}` : null].filter(Boolean).join(", ");
    add(imoveis.length > 1 ? `Imóvel ${n + 1}` : "Imóvel", desc);
    add(imoveis.length > 1 ? `Avaliação do imóvel ${n + 1}` : "Avaliação da garantia", aval);
  });
  return linhas;
}

export function montarCorpo(o: { proposta: PropostaEnvio; documentos: { nome_documento: string; file_name: string }[]; mensagem?: string | null; parte: number; total: number; remetenteNome?: string | null }): string {
  const linhas = linhasDoCorpo(o.proposta)
    .map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#9AABC0;font-size:12px;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:7px 0;color:#F0ECE4;font-size:13px">${esc(v)}</td></tr>`).join("");
  const docs = o.documentos.map((d) => `<li style="margin:0 0 4px">${esc(d.nome_documento)} <span style="color:#7A8FA8">(${esc(d.file_name)})</span></li>`).join("");
  const msg = o.mensagem?.trim() ? `<p style="margin:0 0 18px;color:#F0ECE4;font-size:14px;line-height:1.6;white-space:pre-wrap">${esc(o.mensagem.trim())}</p>` : "";
  const parte = o.total > 1 ? `<p style="margin:0 0 14px;color:#E8C97A;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Parte ${o.parte} de ${o.total}</p>` : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#09081A;font-family:'DM Sans',Arial,sans-serif">
<div style="max-width:620px;margin:32px auto;background:#111F35;border:1px solid #243A66;border-radius:12px;overflow:hidden">
  <div style="padding:22px 28px;border-bottom:1px solid #243A66;background:#09081A">
    <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:30px;display:block">
  </div>
  <div style="padding:28px">
    <p style="margin:0 0 6px;color:#C9A84C;font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">Mesa de Crédito V3 · Encaminhamento de proposta</p>
    <h1 style="margin:0 0 18px;color:#F0ECE4;font-size:20px">Proposta ${esc(o.proposta.code)}</h1>
    ${parte}${msg}
    <table style="border-collapse:collapse;width:100%;margin:0 0 20px">${linhas}</table>
    <p style="margin:0 0 8px;color:#C9A84C;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase">Documentos anexados${o.total > 1 ? " nesta parte" : ""}</p>
    <ul style="margin:0 0 20px;padding-left:18px;color:#F0ECE4;font-size:13px">${docs || "<li>Nenhum documento nesta parte.</li>"}</ul>
    <p style="margin:0;color:#9AABC0;font-size:13px">Para responder, use o próprio e-mail${o.remetenteNome ? `: a resposta chega a ${esc(o.remetenteNome)}, da mesa da V3` : ""}.</p>
  </div>
  <div style="padding:16px 28px;border-top:1px solid #243A66;background:#09081A">
    <p style="margin:0 0 6px;color:#7A8FA8;font-size:11px;line-height:1.5">${esc(RODAPE_CONFIDENCIALIDADE)}</p>
    <p style="margin:0;color:#7A8FA8;font-size:11px">V3 Partners Soluções Ltda. · CNPJ 14.219.287/0001-50</p>
  </div>
</div></body></html>`;
}

// ── Situação de cada e-mail ─────────────────────────────────────────────────────────────────
export type Situacao = "enviado" | "entregue" | "aberto" | "atrasado" | "devolvido" | "spam" | "falha";

export const EVENTO_PARA_SITUACAO: Record<string, Situacao | undefined> = {
  "email.sent": "enviado",
  "email.delivered": "entregue",
  "email.delivery_delayed": "atrasado",
  "email.bounced": "devolvido",
  "email.complained": "spam",
  "email.opened": "aberto",
};

/** Nova situação a partir de um evento. Nunca rebaixa (entregue depois de aberto continua aberto). */
export function proximaSituacao(atual: Situacao, nova: Situacao): Situacao {
  if (atual === "devolvido" || atual === "spam") return atual === "devolvido" && nova === "spam" ? "spam" : atual;
  if (nova === "devolvido" || nova === "spam" || nova === "falha") return nova;
  const rank: Record<Situacao, number> = { falha: 0, enviado: 1, atrasado: 2, entregue: 3, aberto: 4, devolvido: 9, spam: 9 };
  return rank[nova] > rank[atual] ? nova : atual;
}

/** Situação geral do envio: a pior entre os destinatários. */
export const ORDEM_GRAVIDADE: Situacao[] = ["devolvido", "spam", "falha", "atrasado", "enviado", "entregue", "aberto"];
export function situacaoGeral(lista: Situacao[]): Situacao | null {
  for (const s of ORDEM_GRAVIDADE) if (lista.includes(s)) return s;
  return null;
}
