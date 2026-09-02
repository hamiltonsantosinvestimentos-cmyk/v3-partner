import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateAndStoreCreditReportPdf } from "@/lib/credit-report-generate";

/**
 * Gera o PDF do dossiê de crédito a partir de QUALQUER credit_profile.
 *
 * Existe porque a rota antiga (orders/[id]/generate-report) só sabia gerar a
 * partir de um partner_service_orders, o que deixava de fora toda análise
 * disparada pela Mesa ou pelo motor. Esta rota é a que o W-CREDIT chama no n8n
 * ao final da análise, para o dossiê nascer junto com o perfil.
 *
 * Núcleo da geração (build do dado + PDF + upload) mora em
 * lib/credit-report-generate.ts desde 02/09/2026, reusado também por
 * app/api/credit-engine/trigger/route.ts (regeneração automática depois que
 * o CheckTudo/BACEN responde — ver comentário lá).
 *
 * Autenticação: sessão do portal com papel permitido, OU Bearer CRON_SECRET,
 * que é como o n8n se identifica (o workflow roda sem sessão de usuário).
 */

export const maxDuration = 300;
export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"] as const;

interface RouteParams {
  params: Promise<{ profileId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { profileId } = await params;

  // n8n (sem sessão) autentica por Bearer; a Mesa autentica pela sessão do portal.
  const auth = req.headers.get("authorization");
  const viaServico = !!process.env.CRON_SECRET && auth === `Bearer ${process.env.CRON_SECRET}`;

  if (!viaServico) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    if (!profile || !ALLOWED_ROLES.includes(profile.role as (typeof ALLOWED_ROLES)[number])) {
      return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
    }
  }

  const result = await generateAndStoreCreditReportPdf(profileId);
  if (!result.ok) {
    const status = result.error === "Perfil de crédito não encontrado" ? 404 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json(result);
}
