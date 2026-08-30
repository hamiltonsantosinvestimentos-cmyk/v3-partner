import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Mitigação de Erro na LOI Casada (BRIEF 30/08/2026, item residual 2): antes
// a Mesa digitava o UUID da LOI de compra casada em texto livre, risco real
// de erro de digitação. Esta rota lista as LOIs de compra ativas e válidas
// pra virar um dropdown/autocomplete no lugar do campo livre.
//
// Decisão deliberada, confirmada por João: NUNCA devolver nome, e-mail ou
// documento da contraparte real da operação. O formulário de geração de LOI
// hoje só captura indicadores (parties[].role="indicador"), nunca o
// comprador/vendedor da operação em si — e mesmo se capturasse, expor essa
// identidade aqui quebraria o mecanismo anti-bypass que é o motivo de existir
// da LOI (a V3 se mantém entre as duas pontas, cada lado nunca vê o outro).
// Por isso a rota devolve só metadado operacional: código, valor, título.
function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["ADMIN", "GESTAO", "MESA_OPERACIONAL"].includes(profile.role as string)) return null;
  return user.id;
}

export async function GET() {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  // "Ativa e válida" = série V3C-LOI, lado compra, nunca cancelada. Não
  // filtra por status_signature além disso (rascunho/enviado/assinado todos
  // contam) — o próprio gate de geração (generate/route.ts) já decide o que
  // fazer com valor/casamento, esta rota só evita erro de digitação de UUID.
  //
  // operation_contracts não tem coluna contract_series própria (só
  // contract_templates tem — confirmado lendo generate/route.ts antes de
  // escrever esta query). O código emitido por next_v3_code() sempre começa
  // com o nome da série, então o prefixo "V3C-LOI-" identifica a série sem
  // precisar de join com contract_templates.
  const { data, error } = await svc()
    .from("operation_contracts")
    .select("id, contract_code, contract_title, valor_operacao, status_signature, created_at")
    .like("contract_code", "V3C-LOI-%")
    .eq("loi_side", "compra")
    .neq("status_signature", "cancelado")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    candidates: (data ?? []).map((c) => ({
      id: c.id,
      contract_code: c.contract_code,
      contract_title: c.contract_title,
      valor_operacao: c.valor_operacao,
      status_signature: c.status_signature,
    })),
  });
}
