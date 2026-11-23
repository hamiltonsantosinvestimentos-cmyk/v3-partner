import Link from "next/link";
import { headers } from "next/headers";
import { Building2, ShieldCheck } from "lucide-react";
import { createClient as sc } from "@supabase/supabase-js";
import { contextoEnterprise, MAX_USUARIOS } from "@/lib/enterprise";
import { decidirModoAdmin } from "@/lib/enterprise-admin-modo";
import { logAudit } from "@/lib/audit";
import { EnterpriseClient } from "@/components/enterprise/enterprise-client";

export const dynamic = "force-dynamic";

// Painel do Enterprise (white label): master gerencia até 10 usuários, o % de repasse de cada
// um, a marca e os repasses que ele deve pagar; usuário vê os próprios repasses.
// Modo ADMIN (?master=<id>, BRIEF 2026-11-19_admin-configura-white-label-enterprise.md): o ADMIN
// abre o painel de um master e configura marca e domínio em nome dele. Quem não é ADMIN e manda
// ?master vê só o próprio contexto (o parâmetro é ignorado).
export default async function EnterprisePage({ searchParams }: { searchParams: Promise<{ master?: string }> }) {
  const { master } = await searchParams;
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const db = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Modo ADMIN: só quando o papel lido do banco é ADMIN e o alvo é um master Enterprise.
  let modoAdmin: { masterId: string; masterNome: string } | null = null;
  if (user && master) {
    const { data: caller } = await db.from("profiles").select("role, full_name").eq("id", user.id).maybeSingle();
    if (caller?.role === "ADMIN") {
      const { data: alvo } = await db
        .from("profiles")
        .select("id, role, enterprise_id, full_name")
        .eq("id", /^[0-9a-f-]{36}$/i.test(master) ? master : "00000000-0000-0000-0000-000000000000")
        .maybeSingle();
      const d = decidirModoAdmin({
        permitirAdmin: true,
        callerRole: "ADMIN",
        masterParam: master,
        alvo: alvo ? { role: (alvo.role as string | null) ?? null, enterprise_id: (alvo.enterprise_id as string | null) ?? null } : null,
      });
      if (!d.ok) {
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-sm text-muted-foreground">{d.error}.</p>
          </div>
        );
      }
      modoAdmin = { masterId: alvo!.id as string, masterNome: (alvo!.full_name as string | null) ?? "Enterprise" };
      const h = await headers();
      await logAudit({
        userId: user.id,
        userName: (caller.full_name as string | null) ?? null,
        action: "ACCESS",
        entity: "profiles",
        entityId: modoAdmin.masterId,
        newData: { tela: "/enterprise", resultado: "ok", via_admin: { master_id: modoAdmin.masterId, master_nome: modoAdmin.masterNome } },
        ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
      });
    }
  }

  const ctx = modoAdmin
    ? await contextoEnterprise(db, { id: modoAdmin.masterId, role: "ENTERPRISE", enterprise_id: null })
    : user ? await contextoEnterprise(db, user.id) : null;

  if (!ctx) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Disponível apenas para Enterprise.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {modoAdmin && (
        <div className="sticky top-0 z-10 rounded-xl border border-[#C9A84C]/50 bg-[#162744] px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
          <p className="text-sm text-[#E8C97A] flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              Modo ADMIN: você está vendo o Enterprise de <strong>{modoAdmin.masterNome}</strong> e configurando marca e domínio. Cada alteração fica registrada no log com o seu nome.
            </span>
          </p>
          <Link href="/usuarios" className="text-xs font-semibold text-[#C9A84C] hover:text-[#E8C97A] underline underline-offset-2">Voltar para Usuários</Link>
        </div>
      )}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Building2 className="w-6 h-6 text-[#C9A84C]" />
          {ctx.marca?.nome ?? "Enterprise"}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {modoAdmin
            ? `Marca, domínio, usuários e repasses do Enterprise de ${modoAdmin.masterNome}.`
            : ctx.ehMaster
              ? `Sua equipe (até ${MAX_USUARIOS} usuários), o % de comissão de cada um, os repasses que você paga e a marca da plataforma.`
              : "Seus repasses: o que o Enterprise paga a você pelas suas vendas."}
        </p>
      </div>
      <EnterpriseClient
        ehMaster={ctx.ehMaster}
        marcaInicial={ctx.marca}
        limite={MAX_USUARIOS}
        masterId={modoAdmin?.masterId}
        masterNome={modoAdmin?.masterNome}
      />
    </div>
  );
}
