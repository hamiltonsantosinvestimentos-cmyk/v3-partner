import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { resolveVerticalBlocks, wrapContractInV3Html } from "@/lib/contract-render";
import { renderContractDocx } from "@/lib/contract-docx-render";
import { htmlToPdfBase64 } from "@/lib/esignature/clicksign-provider";
import { revokedContactsError } from "@/lib/contract-revoked-contacts";
import { MESA_OPERACIONAL_VERTICALS } from "@/lib/contract-verticals";
import { logAuditStrict, getClientIp } from "@/lib/audit";

export const maxDuration = 60;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const QUALIFICACAO_FIXA =
  "[Qualificação das partes: preenchida no contrato definitivo a partir do formulário de qualificação de cada parte]";
const NOTA_PAGINA = "Minuta para análise jurídica prévia, sem validade para assinatura";

function dataBr(d: Date): string {
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });
}
function dataIso(d: Date): string {
  // en-CA formata como AAAA-MM-DD.
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function slug(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

// GET /api/contracts/templates/[id]/export?formato=docx|pdf&destino=... (BRIEF 21/10/2026)
//
// Baixa o texto da minuta no papel timbrado oficial para o advogado de uma parte revisar antes da
// assinatura. Nenhum dado das contrapartes: a qualificação delas vira texto fixo e as demais
// variáveis viram "[a preencher]". O download é registrado em audit_logs ANTES de o arquivo ser
// gerado, com o destino informado; se o registro falhar, nada é entregue.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  const db = svc();
  const { data: profile } = await db.from("profiles").select("role, full_name").eq("id", user.id).single();
  const role = profile?.role as string | undefined;
  if (!role || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(role)) {
    return NextResponse.json({ error: "Sem permissão para baixar minutas." }, { status: 403 });
  }

  const url = new URL(req.url);
  const formato = url.searchParams.get("formato");
  if (formato !== "docx" && formato !== "pdf") {
    return NextResponse.json({ error: "Formato inválido. Use docx ou pdf." }, { status: 422 });
  }
  const destino = (url.searchParams.get("destino") ?? "").replace(/\s+/g, " ").trim();
  if (destino.length < 3 || destino.length > 120) {
    return NextResponse.json({ error: "Informe para quem o arquivo será enviado (3 a 120 caracteres)." }, { status: 422 });
  }

  const { id } = await params;
  const { data: template } = await db
    .from("contract_templates")
    .select("id, template_name, vertical, version, approval_status, is_active, updated_at, body_text_raw")
    .eq("id", id)
    .single();
  if (!template) return NextResponse.json({ error: "Minuta não encontrada." }, { status: 404 });
  if (!template.is_active) return NextResponse.json({ error: "Minuta inativa não pode ser baixada." }, { status: 409 });
  if (role === "MESA_OPERACIONAL" && template.vertical !== "multi_vertical" && !MESA_OPERACIONAL_VERTICALS.includes(template.vertical as string)) {
    return NextResponse.json({ error: "Esta minuta não pertence às verticais da Mesa Operacional." }, { status: 403 });
  }
  const revokedError = revokedContactsError(template.body_text_raw as string | null, "minuta");
  if (revokedError) return NextResponse.json({ error: revokedError }, { status: 422 });

  const aprovada = template.approval_status === "aprovado";
  const versao = template.version ?? 1;
  const dataVersao = dataBr(new Date(template.updated_at as string));

  try {
    await logAuditStrict({
      userId: user.id,
      userName: (profile?.full_name as string | null) ?? null,
      action: "EXPORT",
      entity: "contract_templates",
      entityId: template.id,
      newData: { evento: "minuta_exportada_analise_juridica", versao, formato, approval_status: template.approval_status, encaminhado_para: destino },
      ipAddress: getClientIp(req),
    });
  } catch (e) {
    console.error("[templates/export] falha ao registrar o download:", e);
    return NextResponse.json({ error: "Não foi possível registrar o download. Tente de novo." }, { status: 500 });
  }

  let corpo = resolveVerticalBlocks(String(template.body_text_raw ?? ""), String(template.vertical ?? ""));
  corpo = corpo
    .replace(/\{\{~[^}]*\}\}/g, "")
    .replace(/\{\{\s*party_qualifications_block\s*\}\}/g, `<p>${QUALIFICACAO_FIXA}</p>`)
    .replace(/\{\{[^}]+\}\}/g, "[a preencher]");
  const faixa =
    `<p><strong>MINUTA PARA ANÁLISE JURÍDICA PRÉVIA. SEM VALIDADE PARA ASSINATURA. Versão ${versao} de ${dataVersao}.` +
    `${aprovada ? "" : " Texto ainda não aprovado pelos sócios."}</strong></p>`;
  // A faixa entra depois do envelope: antes do título do corpo, o envelope não reconheceria o
  // título próprio da minuta e imprimiria o nome interno do modelo.
  const html = wrapContractInV3Html(String(template.template_name), corpo).replace(/(<body[^>]*>)/i, `$1${faixa}`);

  const nome = `${slug(String(template.template_name))}_v${versao}_minuta-para-analise-juridica_${dataIso(new Date())}`;
  try {
    if (formato === "docx") {
      const buf = await renderContractDocx(html, undefined, null, { headerNote: NOTA_PAGINA, requireLetterhead: true });
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${nome}.docx"`,
          "Cache-Control": "no-store",
        },
      });
    }
    const dataUri = await htmlToPdfBase64(html, { headerNote: NOTA_PAGINA, requireLetterhead: true });
    const pdf = Buffer.from(dataUri.replace(/^data:application\/pdf;base64,/, ""), "base64");
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nome}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    if (e instanceof Error && e.message === "LETTERHEAD_UNAVAILABLE") {
      return NextResponse.json({ error: "Não foi possível carregar o papel timbrado. Tente de novo." }, { status: 502 });
    }
    console.error("[templates/export] falha ao gerar o arquivo:", e);
    return NextResponse.json({ error: "Não foi possível gerar o arquivo. Tente de novo." }, { status: 500 });
  }
}
