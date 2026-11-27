import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { contextoEnterprise, idsDaEquipe } from "@/lib/enterprise";
import { COLUNAS_VISAO } from "@/lib/api-v1/visao-partner";
import { semAnaliseDoSite } from "@/lib/analise-site";
import type { PortfolioLinhaDocs } from "@/lib/credit-checklists";
import { acessoMesaEquipe, cardDaEquipe, LIMITE_MESA, ordenarUsuarios } from "@/lib/enterprise/mesa-equipe";
import { MesaEquipeClient } from "@/components/enterprise/mesa-equipe-client";

export const dynamic = "force-dynamic";

// Mesa Operacional do master Enterprise: só acompanhar as operações da equipe.
// BRIEF docs/briefs/2026-11-26_mesa-operacional-master-enterprise.md
// Leitura com service role no servidor; o acesso é decidido aqui (master) e o filtro é sempre
// partner_id in idsDaEquipe(master). Ao cliente vai só o card montado pela visão do partner.
export default async function MesaEquipePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const svc = sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const ctx = await contextoEnterprise(svc, user.id);
  const acesso = acessoMesaEquipe(user, ctx);
  if (acesso === "login") redirect("/login");
  if (acesso === "negado") redirect("/unauthorized");

  const ids = await idsDaEquipe(svc, user.id);
  const [props, perfis, port] = await Promise.all([
    svc.from("credit_desk_proposals").select(COLUNAS_VISAO).in("partner_id", ids)
      .order("updated_at", { ascending: false }).limit(LIMITE_MESA),
    svc.from("profiles").select("id, full_name").in("id", ids),
    svc.from("portfolio_linhas").select("nome, documentos_pf, documentos_pj").eq("ativo", true),
  ]);

  if (props.error || perfis.error || port.error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-muted-foreground">Não foi possível carregar as operações agora.</p>
      </div>
    );
  }

  const linhas = (props.data ?? []) as unknown as Record<string, unknown>[];
  const nomes = new Map(((perfis.data ?? []) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]));
  const portfolio = (port.data ?? []) as PortfolioLinhaDocs[];
  const cards = semAnaliseDoSite(linhas).map((l) => cardDaEquipe(l, { portfolio, nomes }));
  const usuarios = ordenarUsuarios([...nomes].map(([id, nome]) => ({ id, nome })), user.id);
  // O filtro por usuário precisa do id do originador: mapeia o card ao partner sem levar mais nada.
  const originadorId = Object.fromEntries(linhas.map((l) => [String(l.id), String(l.partner_id ?? "")]));

  return (
    <MesaEquipeClient
      cards={cards}
      usuarios={usuarios}
      originadorId={originadorId}
      limiteAtingido={linhas.length >= LIMITE_MESA}
    />
  );
}
