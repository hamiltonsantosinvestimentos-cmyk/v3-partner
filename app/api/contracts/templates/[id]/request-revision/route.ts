import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { triggerContractRevisionAgent } from "@/lib/contract-revision-agent";

// POST /api/contracts/templates/[id]/request-revision — "Pedir Ajuste ao
// Agente" (BRIEF 02/09/2026, aprovado por João). O revisor/Mesa digita o
// que precisa mudar na minuta atual, e um agente de IA produz uma nova
// versão, sem precisar editar manualmente.
//
// Generalizado em 14/09/2026 (pedido de João/Dr. Athaydes) pra QUALQUER
// origem, não só agente_ia/agente_ia_estruturador -- antes disso, 17 das 18
// minutas reais (origem=manual) nunca podiam usar isso. Reaproveita o
// webhook único v3-contract-revise (workflow n8n "W19"), que agora tem um
// terceiro prompt ("Ajuste Pontual de Revisor") pra qualquer origem que não
// seja uma das duas de IA, chamando de volta o callback novo
// app/api/contracts/templates/[id]/revision-callback (que, diferente de
// draft-callback/analysis-callback, abre rodada nova de revisão -- ver
// comentário lá).

const WRITE_ROLES = ["ADMIN", "GESTAO"] as const;

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireWriter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !WRITE_ROLES.includes(profile.role as typeof WRITE_ROLES[number])) return null;
  return { userId: user.id };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const caller = await requireWriter();
  if (!caller) return NextResponse.json({ error: "Apenas ADMIN ou GESTAO podem pedir ajuste ao agente" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { instrucao } = body as { instrucao?: string };

  if (!instrucao?.trim() || instrucao.trim().length < 5)
    return NextResponse.json({ error: "Descreva o ajuste que precisa (mínimo 5 caracteres)" }, { status: 422 });

  const db = svc();

  const { data: template } = await db
    .from("contract_templates")
    .select("id, template_name, origem, analysis_status, approval_status, body_text_raw, vertical, contract_series")
    .eq("id", id)
    .single();

  if (!template) return NextResponse.json({ error: "Minuta não encontrada" }, { status: 404 });

  // As duas origens de IA seguem para draft-callback/analysis-callback
  // (inalterado), que NUNCA avançam review_round -- correto pra elas porque
  // sempre nascem em rodada nova, sem voto ainda. Habilitar "reprovado"
  // nessas duas reintroduziria o bug já documentado de voto antigo contando
  // pro texto novo (ver comentário em revision-callback/route.ts), então
  // mantêm a restrição original. Qualquer outra origem (a generalização de
  // 14/09/2026) vai para revision-callback, que já bumpa a rodada certo.
  const isAgentOrigin = template.origem === "agente_ia" || template.origem === "agente_ia_estruturador";

  if (isAgentOrigin) {
    if (template.analysis_status !== "concluido")
      return NextResponse.json({ error: `Minuta precisa ter uma versão concluída antes de pedir ajuste (status atual: ${template.analysis_status})` }, { status: 409 });
    if (!["rascunho", "em_revisao"].includes(template.approval_status as string))
      return NextResponse.json({ error: `Minuta em status "${template.approval_status}" não aceita ajuste direto do agente. Use a edição manual.` }, { status: 409 });
  } else {
    if (template.analysis_status === "processando")
      return NextResponse.json({ error: "Já existe um ajuste em andamento para esta minuta." }, { status: 409 });
    if (template.approval_status === "aprovado")
      return NextResponse.json({ error: "Minuta aprovada não aceita ajuste direto do agente. Use a edição manual (reabre revisão)." }, { status: 409 });
  }

  const result = await triggerContractRevisionAgent(db, template, instrucao.trim(), {
    actorId: caller.userId,
    actorName: "Mesa/Revisor",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    ok: true,
    analysis_status: "processando",
    message: "Ajuste solicitado. O agente está revisando a minuta com base na instrução.",
  }, { status: 202 });
}
