import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";

// Substitui o antigo fluxo de assinatura em plataforma (POST /api/contratos/
// parceria) — decisão do Hamilton, 15/09/2026: "tirar [a assinatura na
// primeira tela], somente informar que iremos enviar o contrato em seguida
// através do jurídico". Não cria mais um partner_contracts (não é uma
// assinatura de verdade, só o aviso sendo reconhecido) — o contrato real
// passa a ser enviado pelo jurídico fora da plataforma, mesmo caminho que
// PARTNER_HE já usava.
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Reaproveita a mesma flag (contract_signed) que já é checada em
  // app/(platform)/layout.tsx para liberar o acesso — nome antigo, semântica
  // nova: agora significa "já viu o aviso do contrato", não "assinou".
  const { error } = await svc.auth.admin.updateUserById(user.id, {
    app_metadata: { must_change_password: false, contract_signed: true },
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
