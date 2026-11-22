import { createClient as sc } from "@supabase/supabase-js";
import { requireRole } from "@/lib/auth/require-role";
import { nomeDaMarca, MAX_USUARIOS } from "@/lib/enterprise";
import { AdminEnterprisesClient, type EnterpriseLinha } from "@/components/admin-enterprises/admin-enterprises-client";

export const dynamic = "force-dynamic";

// Aba "Enterprises" do ADMIN: clientes Enterprise (masters), a equipe de cada um e o white label.
// BRIEF docs/briefs/2026-11-20_aba-enterprises-admin-e-equipe-fora-das-listas.md
// requireRole lê o papel do banco; a leitura abaixo usa service role só depois disso.
export default async function AdminEnterprisesPage() {
  await requireRole(["ADMIN"]);
  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const [{ data: masters }, { data: equipe }] = await Promise.all([
    svc
      .from("profiles")
      .select("id, full_name, email, is_active, trial_expires_at, created_at, white_label_nome, white_label_logo_url, white_label_dominio, white_label_dominio_status")
      .eq("role", "ENTERPRISE")
      .is("enterprise_id", null)
      .order("created_at", { ascending: false }),
    svc
      .from("profiles")
      .select("id, full_name, email, is_active, enterprise_id")
      .not("enterprise_id", "is", null),
  ]);

  // Agrupa a equipe por master no servidor (sem RPC nem view).
  const porMaster = new Map<string, EnterpriseLinha["equipe"]>();
  for (const u of (equipe ?? []) as { id: string; full_name: string | null; email: string; is_active: boolean | null; enterprise_id: string }[]) {
    const lista = porMaster.get(u.enterprise_id) ?? [];
    lista.push({ id: u.id, nome: u.full_name ?? "", email: u.email, ativo: u.is_active !== false });
    porMaster.set(u.enterprise_id, lista);
  }
  const agora = new Date().getTime();
  const cmp = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

  const linhas: EnterpriseLinha[] = ((masters ?? []) as Record<string, unknown>[]).map((m) => {
    const marcaNome = typeof m.white_label_nome === "string" && m.white_label_nome.trim() ? m.white_label_nome.trim() : null;
    const eq = (porMaster.get(m.id as string) ?? []).sort((a, b) => cmp(a.nome, b.nome));
    return {
      id: m.id as string,
      masterNome: (m.full_name as string | null) ?? "",
      masterEmail: (m.email as string | null) ?? "",
      marca: marcaNome,
      marcaExibida: nomeDaMarca({ marcaNome, masterNome: m.full_name }),
      logoUrl: (m.white_label_logo_url as string | null) ?? null,
      dominio: (m.white_label_dominio as string | null) ?? null,
      dominioStatus: (m.white_label_dominio_status as string | null) ?? null,
      ativo: m.is_active !== false,
      acessoAte: (m.trial_expires_at as string | null) ?? null,
      acessoVencido: !!m.trial_expires_at && new Date(m.trial_expires_at as string).getTime() < agora,
      criadoEm: m.created_at as string,
      equipe: eq,
    };
  });

  return <AdminEnterprisesClient iniciais={linhas} maxUsuarios={MAX_USUARIOS} />;
}
