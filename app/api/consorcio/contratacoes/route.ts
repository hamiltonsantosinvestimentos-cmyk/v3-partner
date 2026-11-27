// Contratação de cotas novas (quiz em Consórcio › Projetos).
// BRIEF docs/briefs/2026-11-27_contratar-cota-nova-em-projetos.md
// Exceção aceita (go mesmo assim do Hamilton, 27/11/2026): o recorte por papel fica nesta rota (service
// role); a tabela é fechada a anon e authenticated. WhatsApp e e-mail completos só saem pela rota
// [id]/contato, com log em audit_logs.
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc, type SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { auditHtml, auditText } from "@/lib/brand-guardian-gate";
import { escapeHtml } from "@/lib/html-escape";
import { issueV3Code } from "@/lib/v3-codes";
import { reservarVagaOuNegar } from "@/lib/creation-quota-route";
import { contextoEnterprise, idsDaEquipe, marcasDosPartners, nomeDaMarca } from "@/lib/enterprise";
import { indicadoresMercado } from "@/lib/mercado/fontes";
import { origemDaOferta } from "@/lib/consorcio/ofertas-acompanhamento";
import { ehInterno } from "../vitrine";
import {
  COLUNAS_CONTRATACAO, QUANDO, ROTULO_STATUS, SEGMENTOS, contratacaoParaLista, ehStatusValido, ordenarContratacoes,
  podeVerContratacao, textoAutorizacao, validarPedido, type Viewer,
} from "@/lib/consorcio/contratacoes";

export const dynamic = "force-dynamic";

const LIMITE_DEMAIS = 300;
const ABERTOS = ["NOVA", "EM_COTACAO"];
// E-mails fixos pedidos pelo Hamilton (27/11/2026). Trocar exige deploy, como lib/socios-notify.ts.
const EMAILS_AVISO = ["robson.lino@v3partners.com.br", "hamilton@v3partners.com.br"];

const svc = () => sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/** Tabela ainda não criada (deploy antes da migration). */
function tabelaAusente(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || /consorcio_contratacoes/.test(e.message ?? "") && /exist|schema cache/i.test(e.message ?? ""));
}

type Perfil = { id: string; full_name: string | null; role: string | null; enterprise_id: string | null };

async function sessao(): Promise<{ perfil: Perfil } | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await svc().from("profiles").select("id, full_name, role, enterprise_id").eq("id", user.id).maybeSingle();
  return { perfil: (data as Perfil | null) ?? { id: user.id, full_name: null, role: null, enterprise_id: null } };
}

async function viewerDe(db: SupabaseClient, perfil: Perfil): Promise<Viewer> {
  const interno = ehInterno(perfil.role);
  return { id: perfil.id, interno, equipe: interno ? [] : await idsDaEquipe(db, { id: perfil.id, role: perfil.role, enterprise_id: perfil.enterprise_id }) };
}

async function marcaDe(db: SupabaseClient, perfil: Perfil): Promise<{ nome: string; logoUrl: string | null } | null> {
  try {
    const ctx = await contextoEnterprise(db, { id: perfil.id, role: perfil.role, enterprise_id: perfil.enterprise_id });
    if (!ctx) return null;
    return { nome: nomeDaMarca(ctx), logoUrl: ctx.marca?.logoUrl ?? null };
  } catch {
    return null;
  }
}

async function mercadoAgora() {
  try {
    const r = await indicadoresMercado();
    if (!r) return null;
    const pega = (id: string) => {
      const i = r.indicadores.find((x) => x.id === id);
      return i && i.valor != null ? { valor: i.valor, referencia: i.referencia } : null;
    };
    const m = { selic: pega("selic"), ipca12: pega("ipca12"), incc: pega("incc") };
    return m.selic || m.ipca12 || m.incc ? m : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const s = await sessao();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  try {
    const viewer = await viewerDe(db, s.perfil);
    const [marca, mercado] = await Promise.all([marcaDe(db, s.perfil), mercadoAgora()]);

    const base = () => {
      const q = db.from("consorcio_contratacoes").select(COLUNAS_CONTRATACAO).is("deleted_at", null);
      return viewer.interno ? q : q.in("created_by", viewer.equipe);
    };
    const [abertos, demais] = await Promise.all([
      base().in("status", ABERTOS).order("created_at", { ascending: false }),
      base().not("status", "in", `(${ABERTOS.join(",")})`).order("created_at", { ascending: false }).limit(LIMITE_DEMAIS),
    ]);
    const erro = abertos.error ?? demais.error;
    if (erro) {
      if (tabelaAusente(erro)) {
        console.error("[consorcio/contratacoes GET] tabela ausente: migration 20261127a ainda não aplicada");
        return NextResponse.json({ contratacoes: [], interno: viewer.interno, marca, mercado, disponivel: false });
      }
      throw new Error(erro.message);
    }

    const linhas = ([...(abertos.data ?? []), ...(demais.data ?? [])] as Record<string, unknown>[]).filter((o) => {
      const ok = podeVerContratacao(viewer, o as { created_by?: string | null });
      if (!ok) console.error("[consorcio/contratacoes GET] linha recusada", { pedido: o.id, viewer: viewer.id });
      return ok;
    });

    const criadores = [...new Set(linhas.map((o) => o.created_by as string | null).filter((x): x is string => !!x))];
    const { data: perfis } = criadores.length
      ? await db.from("profiles").select("id, full_name, role").in("id", criadores)
      : { data: [] as { id: string; full_name: string | null; role: string | null }[] };
    const porId = new Map(((perfis ?? []) as { id: string; full_name: string | null; role: string | null }[]).map((p) => [p.id, p]));
    const marcas = viewer.interno ? await marcasDosPartners(db, criadores) : new Map();

    const contratacoes = ordenarContratacoes(linhas.map((o) => {
      const criador = porId.get(String(o.created_by ?? ""));
      return contratacaoParaLista(o, viewer, {
        enviadoPor: criador?.full_name?.trim() || "Usuário sem nome",
        origem: viewer.interno ? origemDaOferta(marcas, o.created_by as string | null, ehInterno(criador?.role)) : null,
      });
    }));

    return NextResponse.json({ contratacoes, interno: viewer.interno, marca, mercado, disponivel: true });
  } catch (e) {
    console.error("[consorcio/contratacoes GET]", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Não foi possível carregar os pedidos agora." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const s = await sessao();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const v = validarPedido(body);
  if (!v.ok) return NextResponse.json({ error: v.erro }, { status: 400 });
  const d = v.dados;
  const db = svc();
  const { perfil } = s;

  const marca = await marcaDe(db, perfil);
  const consentimentoTexto = textoAutorizacao(marca?.nome);

  const vaga = await reservarVagaOuNegar(req, db, { kind: "user", id: perfil.id, via: "consorcio-contratacoes", papel: perfil.role, nomeUsuario: perfil.full_name });
  if (vaga.negado) return vaga.negado;

  let code: string;
  try {
    code = await issueV3Code("CS", null, db);
  } catch (e) {
    console.error("[consorcio/contratacoes POST] falha ao emitir código:", e instanceof Error ? e.message : String(e));
    await vaga.devolver();
    return NextResponse.json({ error: "Não foi possível enviar o pedido agora. Tente novamente em instantes." }, { status: 500 });
  }

  const agora = new Date().toISOString();
  const { data: criado, error } = await db.from("consorcio_contratacoes").insert({
    code, ...d, consentimento_em: agora, consentimento_texto: consentimentoTexto, status: "NOVA", created_by: perfil.id,
  }).select("id, code").single();
  if (error || !criado) {
    await vaga.devolver();
    if (tabelaAusente(error)) return NextResponse.json({ error: "Contratação indisponível no momento." }, { status: 503 });
    console.error("[consorcio/contratacoes POST] insert", error?.code, error?.message);
    return NextResponse.json({ error: "Não foi possível enviar o pedido agora. Tente novamente em instantes." }, { status: 500 });
  }

  // Avisos: cada um isolado; falha aqui não desfaz o pedido.
  const seg = SEGMENTOS[d.segmento].nome;
  const enviadoPor = perfil.full_name?.trim() || "Usuário sem nome";
  let origem = "Não identificada";
  try {
    const marcas = await marcasDosPartners(db, [perfil.id]);
    origem = origemDaOferta(marcas, perfil.id, ehInterno(perfil.role));
  } catch { /* mantém "Não identificada" */ }
  const resumo = `${d.cliente_nome} quer uma carta de ${seg} de ${brl(d.valor_credito)} (parcela até ${brl(d.parcela_maxima)}, ${d.prazo_meses} meses).`;

  try {
    const { data: equipeV3 } = await db.from("profiles").select("id").in("role", ["ADMIN", "GESTAO"]).eq("is_active", true);
    const destinos = new Set(((equipeV3 ?? []) as { id: string }[]).map((p) => p.id));
    if (perfil.enterprise_id && perfil.enterprise_id !== perfil.id) {
      const { data: master } = await db.from("profiles").select("id, is_active").eq("id", perfil.enterprise_id).maybeSingle();
      if (master && (master as { is_active?: boolean }).is_active !== false) destinos.add(perfil.enterprise_id);
    }
    destinos.delete(perfil.id);
    if (destinos.size) {
      const { error: nErr } = await db.from("notifications").insert([...destinos].map((uid) => ({
        user_id: uid,
        title: "Contratação de cota nova",
        message: `Pedido ${criado.code}: ${resumo} Origem: ${origem}. Enviado por ${enviadoPor}.`,
        type: "CONSORCIO_CONTRATACAO",
        action_url: "/consorcio/projetos#cotas-novas",
        read: false,
      })));
      if (nErr) console.error("[consorcio/contratacoes POST] notificações", nErr.code);
    }
  } catch (e) {
    console.error("[consorcio/contratacoes POST] notificações", e instanceof Error ? e.message : e);
  }

  if (!process.env.EMAIL_FROM) console.error("[consorcio/contratacoes] EMAIL_FROM ausente: e-mail não enviado");
  if (process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.v3partners.com.br";
      const link = `${appUrl}/consorcio/projetos#cotas-novas`;
      const linhaHtml = (k: string, val: string) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid #243A66;"><span style="color:#9BAFC5;font-size:13px;">${escapeHtml(k)}</span><span style="color:#F5F1E8;font-size:13px;font-weight:600;text-align:right;">${escapeHtml(val)}</span></div>`;
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Contratação de cota nova</title></head>
<body style="margin:0;padding:0;background:#09081A;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <p style="margin:0 0 6px;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#C9A84C;">Contratação cota nova</p>
    <h2 style="margin:0 0 20px;font-size:18px;font-weight:700;color:#F5F1E8;">Pedido de cota ${escapeHtml(criado.code)}</h2>
    <div style="background:#111F35;border:1px solid #243A66;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
      ${linhaHtml("Segmento", seg)}
      ${linhaHtml("Carta", brl(d.valor_credito))}
      ${linhaHtml("Parcela até", brl(d.parcela_maxima))}
      ${linhaHtml("Prazo", `${d.prazo_meses} meses`)}
      ${linhaHtml("Lance", d.tem_lance && d.lance_valor ? brl(d.lance_valor) : "Não")}
      ${linhaHtml("Quando quer usar", QUANDO[d.quando])}
      ${linhaHtml("Cliente", d.cliente_nome)}
      ${linhaHtml("Origem", origem)}
      ${linhaHtml("Enviado por", enviadoPor)}
    </div>
    <p style="font-size:12px;color:#9BAFC5;line-height:1.6;margin:0 0 16px;">O contato do cliente fica só na plataforma.</p>
    <p style="margin:0 0 16px;"><a href="${escapeHtml(link)}" style="display:inline-block;background:#C9A84C;color:#09081A;font-size:13px;font-weight:700;text-decoration:none;padding:10px 18px;border-radius:8px;">Ver em Projetos</a></p>
    <p style="margin:0;font-size:11px;color:#9BAFC5;">V3 Partners · Consórcio · Notificação automática</p>
  </div>
</body>
</html>`;
      const assunto = auditText(`Contratação de cota nova: ${criado.code} (${seg})`);
      const corpo = auditHtml(html);
      if (corpo.blocking.length > 0) console.error("[consorcio/contratacoes] Brand Guardian bloqueou:", corpo.blocking);
      await new Resend(process.env.RESEND_API_KEY).emails.send({
        from: process.env.EMAIL_FROM,
        to: EMAILS_AVISO,
        subject: assunto.corrected,
        html: corpo.corrected,
      });
    } catch (e) {
      console.error("[consorcio/contratacoes POST] e-mail", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ ok: true, code: criado.code, marca: marca?.nome ?? null });
}

export async function PATCH(req: NextRequest) {
  const s = await sessao();
  if (!s) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  if (!ehInterno(s.perfil.role)) return NextResponse.json({ error: "Só a equipe V3 muda o status." }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
  const id = typeof body?.id === "string" && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : null;
  if (!id || !ehStatusValido(body?.status)) return NextResponse.json({ error: "Pedido ou status inválido." }, { status: 400 });
  const status = body.status;
  const db = svc();
  const agora = new Date().toISOString();
  const { data, error } = await db.from("consorcio_contratacoes")
    .update({ status, status_atualizado_em: agora, status_atualizado_por: s.perfil.id, updated_at: agora })
    .eq("id", id).is("deleted_at", null)
    .select("id, code, created_by").maybeSingle();
  if (error) {
    console.error("[consorcio/contratacoes PATCH]", error.code, error.message);
    return NextResponse.json({ error: "Não foi possível mudar o status agora." }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });

  const dono = (data as { created_by: string | null }).created_by;
  if (dono && dono !== s.perfil.id) {
    const { error: nErr } = await db.from("notifications").insert({
      user_id: dono,
      title: "Pedido de cota atualizado",
      message: `Seu pedido ${(data as { code: string }).code} agora está: ${ROTULO_STATUS[status]}.`,
      type: "CONSORCIO_CONTRATACAO",
      action_url: "/consorcio/projetos#cotas-novas",
      read: false,
    });
    if (nErr) console.error("[consorcio/contratacoes PATCH] notificação", nErr.code);
  }
  return NextResponse.json({ ok: true, status });
}
