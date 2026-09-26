import { createClient as sc } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";
import { GovernancaPadraoClient, type GovernanceFeatureRow, type GovernanceFindingRow } from "@/components/governanca-padrao/governanca-padrao-client";

export const dynamic = "force-dynamic";

// Tela ADMIN/GESTAO da Varredura Sistemática de Governança (v3-governance-qa),
// aprovada por João em 21/09/2026 depois do piloto de 3 funcionalidades
// (3/3 BLOQUEADO, 26 achados, 2 bugs sistêmicos corrigidos no mesmo dia).
// A rotina agendada em nuvem grava aqui via POST /api/governance/ingest
// (token, nunca sessão) -- esta página só lê, mesmo padrão de
// app/(platform)/usuarios/page.tsx (gate) + app/(platform)/compliance/page.tsx
// (fetch server-side com service client, repassa como prop pro client).
function serviceClient() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export default async function GovernancaPadraoPage() {
  await requireRole(["ADMIN", "GESTAO"]);

  const svc = serviceClient();

  const { data: features } = await svc
    .from("governance_features")
    .select("id, name, area, kind, paths, status, last_audit_run_id, created_at, updated_at")
    .order("area", { ascending: true })
    .order("name", { ascending: true });

  const { data: findings } = await svc
    .from("governance_findings")
    .select("id, feature_id, audit_run_id, rule_id, severity, summary, file_path, line_hint, correction_required, status, pr_url, scheduled_for, created_at")
    .order("scheduled_for", { ascending: true, nullsFirst: false })
    .order("severity", { ascending: true })
    .limit(500);

  return (
    <GovernancaPadraoClient
      features={(features ?? []) as GovernanceFeatureRow[]}
      findings={(findings ?? []) as GovernanceFindingRow[]}
    />
  );
}
