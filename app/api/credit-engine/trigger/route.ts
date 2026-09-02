import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { CREDIT_SOURCE_DEFAULTS } from "@/lib/credit-source-defaults";
import { checktudoLogin, checktudoSCR, type ChecktudoDocType } from "@/lib/checktudo";
import { generateAndStoreCreditReportPdf } from "@/lib/credit-report-generate";

// O node "Gerar Dossiê PDF" do n8n roda DENTRO do webhook chamado abaixo,
// antes do CheckTudo/BACEN sequer começar (ele só roda depois que o webhook
// retorna). Regeneração aqui garante que o PDF final salvo (o que a Mesa e o
// cliente recebem) sempre tem o BACEN quando a fonte está ligada. Puppeteer
// pode levar dezenas de segundos, então o duration precisa acompanhar o do
// próprio gerador (mesmo valor de app/api/credit-engine/report/[profileId]).
export const maxDuration = 300;

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// SCR do CheckTudo (BACEN) — 01/09/2026, decisão de João: fica como dado de
// REFERÊNCIA na tela da proposta, nunca entra no cálculo do Tier/score da V3
// (esse continua vindo só do que o n8n calcula). Roda direto no portal, nunca
// no n8n, mesmo padrão já estabelecido para o CheckTudo em 27/08/2026 (n8n não
// consegue injetar credencial com segurança num node httpRequest, confirmado
// por teste real então). Best-effort: falha aqui nunca derruba a análise.
async function buscarBacenScr(docType: ChecktudoDocType, docValue: string) {
  const username = process.env.CHECKTUDO_USERNAME;
  const password = process.env.CHECKTUDO_PASSWORD;
  if (!username || !password) return null;

  try {
    const session = await checktudoLogin(username, password);
    const raw = await checktudoSCR(session, docType, docValue);
    const scr = (raw?.body as any)?.data?.scr ?? {};
    const consolidado = scr.consolidado ?? {};
    return {
      score_pontuacao: scr.score?.pontuacao ?? null,
      score_faixa: scr.score?.faixa ?? null,
      credito_vencido_valor: consolidado.creditoVencido?.valor ?? null,
      credito_vencido_operacoes: (consolidado.creditoVencido?.operacoes ?? []).map((o: any) => ({
        descricao: o.DESCRICAO ?? null,
        valor: o.VALOR ?? null,
        qtd_meses: o.QTD_MESES ?? null,
      })),
      prejuizo_valor: consolidado.prejuizo?.valor ?? null,
      prejuizo_operacoes: (consolidado.prejuizo?.operacoes ?? []).map((o: any) => ({
        descricao: o.DESCRICAO ?? null,
        valor: o.VALOR ?? null,
        qtd_meses: o.QTD_MESES ?? null,
      })),
      consultado_em: new Date().toISOString(),
    };
  } catch (e) {
    console.error("CheckTudo SCR (BACEN) falhou, seguindo sem esse dado:", e);
    return null;
  }
}

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !ALLOWED_ROLES.includes(profile.role as typeof ALLOWED_ROLES[number])) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  const body = await req.json();
  const { proposal_id } = body;
  if (!proposal_id) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const svc = serviceClient();
  const { data: proposal, error: propErr } = await svc
    .from("credit_desk_proposals")
    .select("id, client_name, client_cpf_cnpj, credit_line, requested_value, current_level")
    .eq("id", proposal_id)
    .single();

  if (propErr || !proposal) {
    return NextResponse.json({ error: "Proposta não encontrada" }, { status: 404 });
  }

  const rawDoc = (proposal.client_cpf_cnpj ?? "").replace(/\D/g, "");
  const subject_type = rawDoc.length === 14 ? "PJ" : "PF";

  // Painel de Configuração de Fontes: usa a config salva pelo CNPJ do titular,
  // ou os defaults (fontes gratuitas ligadas, pagas desligadas) se nunca configurado.
  const { data: sourceConfig } = await svc
    .from("credit_source_configs")
    .select("receita_federal, cnj_datajud, ceis, registrato_bacen, serasa, serasa_modalidade, serasa_cnpj, serasa_cpf, serasa_cpf_list, spc, escavador")
    .eq("cnpj", proposal.client_cpf_cnpj ?? "")
    .single();

  const effectiveSourceConfig = sourceConfig ?? CREDIT_SOURCE_DEFAULTS;

  const webhookRes = await fetch("https://n8n-514n.onrender.com/webhook/v3-credit-engine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      proposal_id: proposal.id,
      subject_name: proposal.client_name,
      subject_cpf_cnpj: proposal.client_cpf_cnpj,
      subject_type,
      analysis_type: "COMPLETA",
      credit_line: proposal.credit_line,
      requested_value: proposal.requested_value,
      current_level: proposal.current_level,
      requested_by: user.id,
      source_config: effectiveSourceConfig,
    }),
  });

  if (!webhookRes.ok) {
    const txt = await webhookRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Falha no motor de crédito: ${txt || webhookRes.status}` },
      { status: 502 }
    );
  }

  const result = await webhookRes.json();

  // Grava o retrato de quais fontes estavam configuradas no momento da análise,
  // para auditoria (o motor n8n ainda não ramifica por source_config, ver Fase 2 da spec).
  if (result?.profile_id) {
    await svc.from("credit_profiles").update({ source_config_snapshot: effectiveSourceConfig }).eq("id", result.profile_id).then(null, () => {});

    // BACEN via CheckTudo (SCR), 01/09/2026: dado de referência, nunca entra no
    // Tier/score da V3. Só roda se a fonte estiver ligada na config efetiva.
    if (effectiveSourceConfig.registrato_bacen && rawDoc) {
      const bacenData = await buscarBacenScr(subject_type === "PJ" ? "cnpj" : "cpf", rawDoc);
      if (bacenData) {
        await svc.from("credit_profiles").update({ bacen_scr_data: bacenData }).eq("id", result.profile_id).then(null, () => {});
        result.bacen_scr = bacenData;

        // Achado 02/09/2026: o PDF que o n8n gerou (dentro do próprio webhook
        // acima) já saiu sem o BACEN, porque essa consulta só termina agora.
        // Regenera o dossiê pra o ponteiro salvo (report_pdf_path) virar o
        // mais completo. Best-effort: falha aqui não derruba a resposta da
        // análise, o Tier/score já estão gravados de qualquer forma.
        const regenerated = await generateAndStoreCreditReportPdf(result.profile_id).catch((e) => {
          console.error("Regeneração do dossiê pós-BACEN falhou:", e);
          return null;
        });
        if (regenerated?.ok) {
          result.pdf_url = regenerated.pdf_url;
          result.pdf_path = regenerated.pdf_path;
        }
      }
    }
  }

  return NextResponse.json(result);
}
