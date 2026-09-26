import type { SupabaseClient } from "@supabase/supabase-js";
import type { Periodo } from "@/lib/relatorio-mensal-partners";

/**
 * Repasses do Enterprise: o que o MASTER deve pagar a cada usuário dele. Nasce 1 repasse por
 * comissão gerada em venda de usuário (lib/credit-commissions.ts). Valor = comissão do master
 * (55%) × % do usuário — calculado na leitura, para acompanhar ajuste da comissão na autorização.
 */

export interface RepasseLinha {
  id: string;
  usuarioId: string;
  usuarioNome: string;
  operacao: string | null;
  descricao: string | null;
  comissaoMaster: number;
  comissaoStatus: string;
  percentual: number;
  valor: number;
  status: "PENDENTE" | "PAGO" | "CANCELADO";
  pagoEm: string | null;
  criadoEm: string;
}

export interface ResumoUsuario {
  usuarioId: string;
  usuarioNome: string;
  percentualAtual: number | null;
  qtd: number;
  total: number;
  pendente: number;
  pago: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function listarRepasses(
  db: SupabaseClient,
  filtro: { enterpriseId?: string; usuarioId?: string; periodo?: Periodo | null },
): Promise<{ linhas: RepasseLinha[]; porUsuario: ResumoUsuario[]; totais: { total: number; pendente: number; pago: number } }> {
  let q = db
    .from("enterprise_repasses")
    .select("id, usuario_id, repasse_percent, status, pago_em, created_at, commission:commissions(commission_value, status, operation_code, operation_description, created_at)")
    .order("created_at", { ascending: false });
  if (filtro.enterpriseId) q = q.eq("enterprise_id", filtro.enterpriseId);
  if (filtro.usuarioId) q = q.eq("usuario_id", filtro.usuarioId);
  if (filtro.periodo) q = q.gte("created_at", filtro.periodo.inicio).lt("created_at", filtro.periodo.fim);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  const usuarioIds = [...new Set((data ?? []).map((r) => r.usuario_id as string))];
  // Todos os usuários do master aparecem no resumo, mesmo sem repasse no período.
  let usuariosQ = db.from("profiles").select("id, full_name, email, enterprise_repasse_percent");
  usuariosQ = filtro.enterpriseId ? usuariosQ.eq("enterprise_id", filtro.enterpriseId) : usuariosQ.in("id", usuarioIds.length ? usuarioIds : ["00000000-0000-0000-0000-000000000000"]);
  const { data: usuarios } = await usuariosQ;
  const nomeDe = new Map((usuarios ?? []).map((u) => [u.id as string, (u.full_name as string) ?? (u.email as string) ?? "Usuário"]));

  const linhas: RepasseLinha[] = (data ?? []).map((r) => {
    const c = (Array.isArray(r.commission) ? r.commission[0] : r.commission) as
      | { commission_value: number | null; status: string; operation_code: string | null; operation_description: string | null }
      | null;
    const comissaoMaster = Number(c?.commission_value ?? 0);
    const percentual = Number(r.repasse_percent ?? 0);
    // Comissão cancelada pela V3 → repasse deixa de ser devido.
    const status = (c?.status === "CANCELADA" ? "CANCELADO" : r.status) as RepasseLinha["status"];
    return {
      id: r.id as string,
      usuarioId: r.usuario_id as string,
      usuarioNome: nomeDe.get(r.usuario_id as string) ?? "Usuário",
      operacao: c?.operation_code ?? null,
      descricao: c?.operation_description ?? null,
      comissaoMaster,
      comissaoStatus: c?.status ?? "",
      percentual,
      valor: status === "CANCELADO" ? 0 : round2((comissaoMaster * percentual) / 100),
      status,
      pagoEm: (r.pago_em as string | null) ?? null,
      criadoEm: r.created_at as string,
    };
  });

  const porUsuario: ResumoUsuario[] = (usuarios ?? []).map((u) => {
    const xs = linhas.filter((l) => l.usuarioId === u.id);
    return {
      usuarioId: u.id as string,
      usuarioNome: nomeDe.get(u.id as string) ?? "Usuário",
      percentualAtual: u.enterprise_repasse_percent != null ? Number(u.enterprise_repasse_percent) : null,
      qtd: xs.length,
      total: round2(xs.reduce((s, l) => s + l.valor, 0)),
      pendente: round2(xs.filter((l) => l.status === "PENDENTE").reduce((s, l) => s + l.valor, 0)),
      pago: round2(xs.filter((l) => l.status === "PAGO").reduce((s, l) => s + l.valor, 0)),
    };
  }).sort((a, b) => b.pendente - a.pendente || b.total - a.total);

  return {
    linhas,
    porUsuario,
    totais: {
      total: round2(linhas.reduce((s, l) => s + l.valor, 0)),
      pendente: round2(linhas.filter((l) => l.status === "PENDENTE").reduce((s, l) => s + l.valor, 0)),
      pago: round2(linhas.filter((l) => l.status === "PAGO").reduce((s, l) => s + l.valor, 0)),
    },
  };
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML (para PDF) do relatório de repasses: quanto o master deve a cada usuário. */
export function htmlRepasses(opts: {
  marcaNome: string;
  masterNome: string;
  periodoLabel: string;
  dados: Awaited<ReturnType<typeof listarRepasses>>;
}) {
  const { dados } = opts;
  const th = (h: string) => `<th align="left" style="padding:7px 6px;border-bottom:1px solid #243A66;color:#9BAFC5;font-size:10px;text-transform:uppercase;">${h}</th>`;
  const td = (v: string, right = false) => `<td ${right ? 'align="right"' : ""} style="padding:7px 6px;border-bottom:1px solid rgba(36,58,102,.5);color:#F0ECE4;font-size:12px;">${v}</td>`;
  const statusLabel: Record<string, string> = { PENDENTE: "A pagar", PAGO: "Pago", CANCELADO: "Cancelado" };
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Repasses</title></head>
<body style="margin:0;background:#09081A;font-family:'DM Sans',Arial,sans-serif;">
<div style="background:#162744;">
  <div style="padding:22px 28px;border-bottom:1px solid #243A66;background:#09081A;">
    <img src="https://app.v3partners.com.br/v3-logo-flat-gold-alpha.png" alt="V3 Partners" style="height:34px;display:block;">
  </div>
  <div style="padding:26px 28px;">
    <p style="margin:0;font-size:10px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:.14em;">${esc(opts.marcaNome)} · Repasses aos usuários</p>
    <h2 style="margin:6px 0 4px;font-size:20px;color:#F0ECE4;">Relatório de repasses · ${esc(opts.periodoLabel)}</h2>
    <p style="margin:0 0 18px;font-size:13px;color:#9BAFC5;">Valores que ${esc(opts.masterNome)} deve pagar a cada usuário: % definido para o usuário × comissão do Enterprise (55%) nas vendas dele.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      ${[["A pagar", dados.totais.pendente], ["Pago", dados.totais.pago], ["Total no período", dados.totais.total]]
        .map(([l, v]) => `<td style="padding:6px;width:33%;"><div style="background:#13223A;border:1px solid #243A66;border-radius:8px;padding:12px 14px;"><div style="font-size:10px;color:#9BAFC5;text-transform:uppercase;">${l}</div><div style="font-size:18px;font-weight:800;color:#F0ECE4;margin-top:4px;">${brl(v as number)}</div></div></td>`)
        .join("")}
    </tr></table>
    <p style="margin:24px 0 8px;font-size:11px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:.12em;">Por usuário</p>
    <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>${["Usuário", "% atual", "Vendas", "A pagar", "Pago", "Total"].map(th).join("")}</tr>
      ${dados.porUsuario.map((u) => `<tr>${td(esc(u.usuarioNome))}${td(u.percentualAtual != null ? `${u.percentualAtual}%` : "—")}${td(String(u.qtd))}${td(brl(u.pendente), true)}${td(brl(u.pago), true)}${td(brl(u.total), true)}</tr>`).join("")}
    </table>
    <p style="margin:24px 0 8px;font-size:11px;font-weight:700;color:#C9A84C;text-transform:uppercase;letter-spacing:.12em;">Detalhe por venda</p>
    ${dados.linhas.length === 0 ? `<p style="font-size:12px;color:#9BAFC5;">Nenhum repasse no período.</p>` : `<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>${["Data", "Usuário", "Operação", "Comissão Enterprise", "%", "Repasse", "Situação"].map(th).join("")}</tr>
      ${dados.linhas.map((l) => `<tr>${td(new Date(l.criadoEm).toLocaleDateString("pt-BR"))}${td(esc(l.usuarioNome))}${td(esc(l.operacao ?? "—"))}${td(brl(l.comissaoMaster), true)}${td(`${l.percentual}%`)}${td(brl(l.valor), true)}${td(statusLabel[l.status] ?? l.status)}</tr>`).join("")}
    </table>`}
    <p style="margin:22px 0 0;font-size:11px;color:#9BAFC5;">Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. O pagamento destes repasses é feito pelo Enterprise, não pela V3.</p>
  </div>
</div></body></html>`;
}
