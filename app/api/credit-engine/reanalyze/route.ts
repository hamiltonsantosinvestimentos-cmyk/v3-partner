import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { estadoDaAnalise, reanalisarPendentes } from "@/lib/credit-reanalysis";

export const dynamic = "force-dynamic";
// Regenera o dossiê (Puppeteer) depois de consultar as fontes: mesmo teto do trigger.
export const maxDuration = 300;

const ALLOWED_ROLES = ["ADMIN", "GESTAO", "MESA_OPERACIONAL"];

function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function autorizado() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: 401, error: "Não autorizado" } as const;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !ALLOWED_ROLES.includes(profile.role)) return { status: 403, error: "Sem permissão" } as const;
  return null;
}

// GET ?proposal_id= — o que já foi consultado e o que falta (não consulta nada, não gera custo)
export async function GET(req: NextRequest) {
  const negado = await autorizado();
  if (negado) return NextResponse.json({ error: negado.error }, { status: negado.status });

  const proposalId = new URL(req.url).searchParams.get("proposal_id");
  if (!proposalId) return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });

  const estado = await estadoDaAnalise(serviceClient(), proposalId);
  if (!estado.ok) return NextResponse.json({ error: estado.error }, { status: estado.status });

  return NextResponse.json({
    ...estado,
    // Para a tela avisar antes de clicar, quando o portal ainda não tem a credencial da fonte
    configurado: {
      serasa: Boolean(process.env.SERASA_CLIENT_ID && process.env.SERASA_CLIENT_SECRET),
      bacen: Boolean(process.env.CHECKTUDO_USERNAME && process.env.CHECKTUDO_PASSWORD),
    },
  });
}

// POST { proposal_id } — consulta só as fontes pendentes, atualiza o mesmo perfil e refaz o dossiê
export async function POST(req: NextRequest) {
  const negado = await autorizado();
  if (negado) return NextResponse.json({ error: negado.error }, { status: negado.status });

  const body = await req.json().catch(() => ({}));
  const proposalId = body?.proposal_id;
  if (!proposalId || typeof proposalId !== "string") {
    return NextResponse.json({ error: "proposal_id obrigatório" }, { status: 400 });
  }

  const r = await reanalisarPendentes(serviceClient(), proposalId);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  return NextResponse.json(r);
}
