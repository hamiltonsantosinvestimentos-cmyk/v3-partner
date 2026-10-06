import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { ADHESION_ALLOWED_ROLES, ADHESION_SERIES, validateAdhesionParent } from "@/lib/contract-adhesion";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Termo de Adesão (06/10/2026): painel "Adesões deste contrato". Somente leitura.
// Mostra só nome e status dos aderentes, nunca CPF, CNPJ ou telefone.
// Ordem cronológica ascendente (created_at). Não altera o contrato de origem.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = svc();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role as string | undefined;
  if (!role || !ADHESION_ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const check = await validateAdhesionParent(db, id, role);

  // Elegibilidade: o botão só aparece quando o servidor confirma. O motivo vai para a tela.
  const eligible = check.ok;
  const reason = check.ok ? null : check.error;

  const { data: children } = await db
    .from("operation_contracts")
    .select("id, contract_code, status_signature, created_at, parties")
    .eq("parent_contract_id", id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const { data: batches } = await db
    .from("cm_qualification_batches")
    .select("id, status, created_at, consumido_por_contract_id, cm_party_qualifications(id, full_name, status, deleted_at, phone, qualification_token)")
    .eq("parent_contract_id", id)
    .order("created_at", { ascending: true });

  let template: { id: string; template_name: string; approval_status: string } | null = null;
  if (check.ok) {
    const { data: t } = await db
      .from("contract_templates")
      .select("id, template_name, approval_status")
      .eq("contract_series", ADHESION_SERIES)
      .eq("is_active", true)
      .eq("vertical", check.parent.vertical)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    template = t ?? null;
  }

  return NextResponse.json({
    eligible,
    reason,
    template,
    children: (children ?? []).map((c) => ({
      id: c.id,
      contract_code: c.contract_code,
      status_signature: c.status_signature,
      created_at: c.created_at,
      aderentes: Array.isArray(c.parties)
        ? (c.parties as { role?: string; name?: string }[]).filter((p) => p.role !== "v3_partners" && p.role !== "head_mesa").map((p) => p.name ?? "")
        : [],
    })),
    pending_batches: (batches ?? [])
      .filter((b) => !b.consumido_por_contract_id)
      .filter((b) => ((b.cm_party_qualifications as { deleted_at: string | null }[]) ?? []).some((p) => !p.deleted_at))
      .map((b) => ({
        id: b.id,
        status: b.status,
        created_at: b.created_at,
        // Nome e status para a lista; telefone e token só servem ao botão de WhatsApp dos convites ainda não preenchidos.
        parties: ((b.cm_party_qualifications as { id: string; full_name: string; status: string; deleted_at: string | null; phone: string | null; qualification_token: string | null }[]) ?? [])
          .filter((p) => !p.deleted_at)
          .map((p) => ({ id: p.id, name: p.full_name, status: p.status, phone: p.status === "preenchido" ? null : p.phone, token: p.status === "preenchido" ? null : p.qualification_token })),
      })),
  });
}
