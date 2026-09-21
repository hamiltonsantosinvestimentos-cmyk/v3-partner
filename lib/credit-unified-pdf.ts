import { PDFDocument } from "pdf-lib";
import type { SupabaseClient } from "@supabase/supabase-js";
import { generateAndStoreCreditReportPdf, launchBrowser } from "@/lib/credit-report-generate";
import { CREDIT_REPORT_STYLE, LOGO_URL } from "@/lib/credit-report-template";
import { REPORT_VALIDITY_DAYS } from "@/lib/credit-report-data";

// PDF UNIFICADO do pedido: uma capa-resumo + o dossiê da empresa + o dossiê de cada sócio/garantidor
// (documentos adicionais do pedido), tudo num arquivo só. Cada dossiê é o MESMO PDF que a Mesa já
// gera (lib/credit-report-generate.ts: nunca montar PDF de crédito por outro caminho); aqui só se
// junta com pdf-lib e se acrescenta a capa. Dossiê já salvo e atualizado é reaproveitado; o que não
// existe ou ficou defasado em relação ao perfil é gerado de novo.

const BUCKET = "credit-documents";
const SIGNED_URL_SECONDS = REPORT_VALIDITY_DAYS * 24 * 60 * 60;
/** PDF salvo é considerado defasado se o perfil foi alterado mais de 1 min depois de gerado. */
const STALE_MS = 60_000;

export interface ParteUnificada {
  papel: string;
  nome: string;
  documento: string;
  tipo: "PF" | "PJ";
  tier: string | null;
  score: number | null;
  serasa: boolean;
  bacen: boolean;
  pagina_inicial: number;
  paginas: number;
  regenerado: boolean;
}

export interface ParteAusente {
  documento: string;
  papel: string;
  motivo: string;
}

export type ResultadoUnificado =
  | {
      ok: true;
      pdf_path: string;
      pdf_url: string | null;
      download_url: string | null;
      total_paginas: number;
      partes: ParteUnificada[];
      ausentes: ParteAusente[];
    }
  | { ok: false; status: number; error: string };

interface PerfilRow {
  id: string;
  subject_name: string | null;
  subject_cpf_cnpj: string | null;
  subject_type: string | null;
  tier: string | null;
  score_total: number | null;
  serasa_data: { error?: unknown } | null;
  bacen_scr_data: unknown | null;
  report_pdf_path: string | null;
  report_generated_at: string | null;
  updated_at: string | null;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fmtDoc(doc: string | null): string {
  const d = (doc ?? "").replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc ?? "";
}

function isFresh(p: PerfilRow): boolean {
  if (!p.report_pdf_path || !p.report_generated_at) return false;
  if (!p.updated_at) return true;
  return new Date(p.updated_at).getTime() - new Date(p.report_generated_at).getTime() <= STALE_MS;
}

async function baixar(db: SupabaseClient, path: string): Promise<Uint8Array | null> {
  const { data, error } = await db.storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

function capaHtml(opts: {
  cliente: string;
  documentoCliente: string;
  partes: ParteUnificada[];
  emitidoEm: string;
}): string {
  const linhas = opts.partes
    .map((p, i) => {
      const tierCor = p.tier === "A" || p.tier === "B" ? "#7FD1A8" : p.tier === "C" ? "#E8C97A" : "#E58A8A";
      const fonte = (ok: boolean, nome: string) =>
        `<span class="fonte ${ok ? "ok" : "falta"}">${ok ? "✓" : "—"} ${nome}</span>`;
      return `<tr>
  <td class="n">${i + 1}</td>
  <td><div class="papel">${esc(p.papel)}</div><div class="nome">${esc(p.nome)}</div></td>
  <td class="doc">${esc(fmtDoc(p.documento))}<div class="nat">${p.tipo === "PJ" ? "Pessoa Jurídica" : "Pessoa Física"}</div></td>
  <td class="cls"><span class="tier" style="color:${tierCor};border-color:${tierCor}">${esc(p.tier ?? "—")}</span><div class="sc">${p.score ?? "—"} pts</div></td>
  <td>${fonte(p.serasa, "Serasa")}<br>${fonte(p.bacen, "BACEN")}</td>
  <td class="pg">${p.pagina_inicial}</td>
</tr>`;
    })
    .join("\n");

  const tiers = opts.partes.filter((p) => p.score != null);
  const pior = tiers.length ? tiers.reduce((a, b) => ((a.score as number) <= (b.score as number) ? a : b)) : null;

  return `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"><title>Dossiê Unificado</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>${CREDIT_REPORT_STYLE}
.cover { padding: 0 48px 40px; }
.cover .report-header { padding-top: 56px; }
.cover .cliente { margin: 34px 0 6px; font-size: 26px; font-weight: 800; color: var(--cr); }
.cover .cliente-doc { font-size: 13px; color: var(--mu); margin-bottom: 26px; }
.resumo { display:flex; gap:14px; margin: 0 0 24px; }
.resumo .box { flex:1; background: var(--nc); border:1px solid var(--nm); border-radius:8px; padding:14px 18px; }
.resumo .lbl { font-size: 9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color: var(--gl); margin-bottom:4px; }
.resumo .val { font-size: 18px; font-weight: 800; color: var(--cr); }
.resumo .sub { font-size: 11px; color: var(--mu); margin-top:2px; }
table.partes { width:100%; border-collapse: collapse; font-size: 12px; }
table.partes th { text-align:left; font-size:9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color: var(--gl); padding: 8px 10px; border-bottom: 1px solid var(--go); }
table.partes td { padding: 12px 10px; border-bottom: 1px solid var(--nm); vertical-align: top; color: var(--cr); }
table.partes .n { color: var(--mu); width: 22px; }
table.partes .papel { font-size: 9.5px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color: var(--gl); }
table.partes .nome { font-weight: 700; font-size: 13px; }
table.partes .doc { font-variant-numeric: tabular-nums; white-space: nowrap; }
table.partes .nat { font-size: 10.5px; color: var(--mu); }
table.partes .cls { white-space: nowrap; }
.tier { display:inline-block; font-weight:800; font-size:15px; border:1.5px solid; border-radius:5px; padding:0 9px; }
.sc { font-size:10.5px; color: var(--mu); margin-top:3px; }
.fonte { font-size: 11px; } .fonte.ok { color:#7FD1A8; } .fonte.falta { color: var(--mu); }
table.partes .pg { text-align:center; font-weight:700; color: var(--gl); width: 44px; }
.nota { margin-top: 22px; font-size: 10.5px; color: var(--mu); line-height:1.6; }
</style></head>
<body>
<div class="gold-stripe"></div>
<div class="cover">
  <div class="report-header">
    <div>
      <img src="${LOGO_URL}" alt="V3 Partners">
      <div class="report-eyebrow">Mesa de Crédito · Motor de Análise V3</div>
      <div class="report-title">Dossiê de Análise de Crédito · Consolidado</div>
      <div class="confidential-badge">Confidencial</div>
    </div>
    <div class="report-meta">Emitido em <strong>${esc(opts.emitidoEm)}</strong><br>Validade de cada dossiê: <strong>${REPORT_VALIDITY_DAYS} dias</strong></div>
  </div>

  <div class="cliente">${esc(opts.cliente)}</div>
  <div class="cliente-doc">${esc(fmtDoc(opts.documentoCliente))}</div>

  <div class="resumo">
    <div class="box"><div class="lbl">Partes analisadas</div><div class="val">${opts.partes.length}</div><div class="sub">empresa e sócios/garantidores</div></div>
    <div class="box"><div class="lbl">Menor pontuação do grupo</div><div class="val">${pior ? `${esc(pior.tier ?? "—")} · ${pior.score} pts` : "—"}</div><div class="sub">${pior ? esc(pior.nome) : ""}</div></div>
  </div>

  <table class="partes">
    <thead><tr><th></th><th>Parte</th><th>Documento</th><th>Classificação</th><th>Fontes pagas</th><th>Pág.</th></tr></thead>
    <tbody>
${linhas}
    </tbody>
  </table>

  <div class="nota">Este arquivo reúne, em sequência, o dossiê de cada parte listada acima. Cada dossiê mantém seu próprio protocolo, data de emissão, fontes consultadas e validade. A classificação de cada parte é calculada individualmente, sem média entre elas.</div>
</div>
</body></html>`;
}

/** Gera (ou reaproveita) o dossiê de cada parte do pedido e junta tudo num PDF único com capa. */
export async function gerarPdfUnificado(db: SupabaseClient, orderId: string): Promise<ResultadoUnificado> {
  const { data: order } = await db
    .from("partner_service_orders")
    .select("id, client_name, client_doc, credit_desk_proposal_id")
    .eq("id", orderId)
    .single();
  if (!order) return { ok: false, status: 404, error: "Pedido não encontrado" };
  if (!order.credit_desk_proposal_id) return { ok: false, status: 409, error: "Pedido ainda não foi vinculado a uma proposta" };

  const { data: mainProposal } = await db
    .from("credit_desk_proposals")
    .select("credit_profile_id")
    .eq("id", order.credit_desk_proposal_id)
    .single();
  if (!mainProposal?.credit_profile_id) return { ok: false, status: 409, error: "A análise da empresa ainda não foi rodada" };

  // Documentos adicionais (sócios/garantidores/CNPJs do grupo)
  const { data: consents } = await db
    .from("credit_consents")
    .select("subject_cpf_cnpj, document_label, status, credit_desk_proposal_id, created_at")
    .eq("partner_service_order_id", orderId)
    .order("created_at", { ascending: true });

  const propIds = (consents ?? []).map((c) => c.credit_desk_proposal_id).filter(Boolean) as string[];
  const perfilPorProposta: Record<string, string> = {};
  if (propIds.length) {
    const { data: props } = await db.from("credit_desk_proposals").select("id, credit_profile_id").in("id", propIds);
    for (const p of props ?? []) if (p.credit_profile_id) perfilPorProposta[p.id] = p.credit_profile_id;
  }

  const ausentes: ParteAusente[] = [];
  const extras: { profileId: string; papel: string; nomeRotulo: string | null; ehPj: boolean }[] = [];
  for (const c of consents ?? []) {
    const doc = (c.subject_cpf_cnpj ?? "").replace(/\D/g, "");
    const ehPj = doc.length === 14;
    // O rótulo do documento adicional é o que a Mesa digitou: pode ser o nome da pessoa
    // ("VIVIANE WIPPEL MOSER") ou o rótulo padrão ("Sócio/garantidor"). Só o padrão vira "papel".
    const rotuloPadrao = !c.document_label || ["Sócio/garantidor", "CNPJ adicional"].includes(c.document_label);
    const papel = ehPj ? "CNPJ do grupo" : "Sócio / garantidor";
    const nomeRotulo = rotuloPadrao ? null : (c.document_label as string);
    const profileId = c.credit_desk_proposal_id ? perfilPorProposta[c.credit_desk_proposal_id] : undefined;
    if (!profileId) {
      ausentes.push({ documento: fmtDoc(doc), papel, motivo: c.status !== "consented" ? "consentimento LGPD pendente" : "análise ainda não rodada" });
    } else {
      extras.push({ profileId, papel, nomeRotulo, ehPj });
    }
  }
  // Empresas do grupo antes das pessoas físicas; dentro de cada grupo, ordem de cadastro
  extras.sort((a, b) => Number(b.ehPj) - Number(a.ehPj));

  const ordem = [
    { profileId: mainProposal.credit_profile_id as string, papel: "", nomeRotulo: null as string | null },
    ...extras.map((e) => ({ profileId: e.profileId, papel: e.papel, nomeRotulo: e.nomeRotulo })),
  ];

  const { data: perfis } = await db
    .from("credit_profiles")
    .select("id, subject_name, subject_cpf_cnpj, subject_type, tier, score_total, serasa_data, bacen_scr_data, report_pdf_path, report_generated_at, updated_at")
    .in("id", ordem.map((o) => o.profileId));
  const perfilMap = new Map((perfis ?? []).map((p) => [p.id, p as PerfilRow]));

  // Dossiê de cada parte (reaproveita o salvo se atual; senão gera de novo, um por vez)
  const pdfs: { bytes: Uint8Array; paginas: number; regenerado: boolean }[] = [];
  for (const o of ordem) {
    const perfil = perfilMap.get(o.profileId);
    if (!perfil) return { ok: false, status: 404, error: "Perfil de crédito de uma das partes não foi encontrado" };
    let bytes: Uint8Array | null = null;
    let regenerado = false;
    if (isFresh(perfil)) bytes = await baixar(db, perfil.report_pdf_path as string);
    if (!bytes) {
      const g = await generateAndStoreCreditReportPdf(perfil.id);
      if (!g.ok) return { ok: false, status: 500, error: `Não foi possível gerar o dossiê de ${perfil.subject_name ?? "uma das partes"}: ${g.error}` };
      bytes = await baixar(db, g.pdf_path);
      regenerado = true;
    }
    if (!bytes) return { ok: false, status: 500, error: `Não foi possível ler o dossiê de ${perfil.subject_name ?? "uma das partes"}` };
    const doc = await PDFDocument.load(bytes);
    pdfs.push({ bytes, paginas: doc.getPageCount(), regenerado });
  }

  const montarPartes = (paginasCapa: number): ParteUnificada[] => {
    let inicio = paginasCapa + 1;
    return ordem.map((o, i) => {
      const p = perfilMap.get(o.profileId) as PerfilRow;
      const tipo: "PF" | "PJ" = p.subject_type === "PJ" ? "PJ" : "PF";
      const parte: ParteUnificada = {
        papel: i === 0 ? (tipo === "PJ" ? "Empresa" : "Titular") : o.papel,
        nome: o.nomeRotulo ?? p.subject_name ?? "—",
        documento: p.subject_cpf_cnpj ?? "",
        tipo,
        tier: p.tier,
        score: p.score_total,
        serasa: !!p.serasa_data && !p.serasa_data.error,
        bacen: !!p.bacen_scr_data,
        pagina_inicial: inicio,
        paginas: pdfs[i].paginas,
        regenerado: pdfs[i].regenerado,
      };
      inicio += pdfs[i].paginas;
      return parte;
    });
  };

  // Capa (Puppeteer). Refaz uma vez se ela ocupar mais de 1 página, para os números de página baterem.
  const emitidoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  let capaBytes: Uint8Array;
  let capaPaginas = 1;
  let partes = montarPartes(capaPaginas);
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const renderCapa = async () => {
      const page = await browser!.newPage();
      await page.setContent(
        capaHtml({ cliente: order.client_name ?? partes[0].nome, documentoCliente: order.client_doc ?? partes[0].documento, partes, emitidoEm }),
        { waitUntil: "load", timeout: 60000 }
      );
      const buf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
      await page.close();
      return new Uint8Array(buf);
    };
    capaBytes = await renderCapa();
    capaPaginas = (await PDFDocument.load(capaBytes)).getPageCount();
    if (capaPaginas !== 1) {
      partes = montarPartes(capaPaginas);
      capaBytes = await renderCapa();
    }
  } catch (e) {
    return { ok: false, status: 500, error: `Falha ao gerar a capa do PDF: ${(e as Error).message}` };
  } finally {
    if (browser) await browser.close();
  }

  // Junta capa + dossiês
  const saida = await PDFDocument.create();
  saida.setTitle(`Dossiê de Análise de Crédito · ${order.client_name ?? partes[0].nome}`);
  saida.setProducer("V3 Partners");
  saida.setCreator("V3 Partners · Mesa de Crédito");
  for (const bytes of [capaBytes, ...pdfs.map((p) => p.bytes)]) {
    const src = await PDFDocument.load(bytes);
    const copiadas = await saida.copyPages(src, src.getPageIndices());
    copiadas.forEach((pg) => saida.addPage(pg));
  }
  const unificado = Buffer.from(await saida.save());

  const pdfPath = `partner-orders/${orderId}/dossie-unificado-${Date.now()}.pdf`;
  const { error: upErr } = await db.storage.from(BUCKET).upload(pdfPath, unificado, { contentType: "application/pdf", upsert: false });
  if (upErr) return { ok: false, status: 500, error: `Falha ao salvar o PDF: ${upErr.message}` };

  const nomeArquivo = `Dossie-Unificado-${(order.client_name ?? "cliente").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "")}.pdf`;
  const [view, down] = await Promise.all([
    db.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS),
    db.storage.from(BUCKET).createSignedUrl(pdfPath, SIGNED_URL_SECONDS, { download: nomeArquivo }),
  ]);

  return {
    ok: true,
    pdf_path: pdfPath,
    pdf_url: view.data?.signedUrl ?? null,
    download_url: down.data?.signedUrl ?? null,
    total_paginas: capaPaginas + pdfs.reduce((s, p) => s + p.paginas, 0),
    partes,
    ausentes,
  };
}
