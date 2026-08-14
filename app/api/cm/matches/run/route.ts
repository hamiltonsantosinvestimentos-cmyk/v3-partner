import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { Resend } from "resend";
import { auditText, auditHtml } from "@/lib/brand-guardian-gate";
import { createNotification } from "@/lib/notify";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

const ADMIN_ROLES = ["ADMIN", "GESTAO"];

function isCronCall(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!auth && auth === `Bearer ${process.env.CRON_SECRET}`;
}

async function getCallerRole(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await svc().from("profiles").select("id, role").eq("id", user.id).single();
  if (!profile || !ADMIN_ROLES.includes(profile.role as string)) return null;
  return { userId: user.id, role: profile.role as string };
}

export async function POST(req: NextRequest) {
  const cron = isCronCall(req);
  if (!cron) {
    const caller = await getCallerRole(req);
    if (!caller) return NextResponse.json({ error: "Não autorizado — apenas ADMIN/GESTAO" }, { status: 401 });
  }

  const { data: matchCount } = await svc().rpc("match_cm_listings_to_demands");

  const newMatches = matchCount ?? 0;

  if (newMatches > 0 && process.env.RESEND_API_KEY) {
    try {
      const { data: matches } = await svc()
        .from("demand_matches")
        .select(`
          id, score, match_reasons,
          investor_demands(nome_contato, email, origin_partner_id),
          cm_asset_listings:listing_id(anonymous_id, asset_type, valor_face, desagio_pretendido, originator_profile_id)
        `)
        .not("listing_id", "is", null)
        .eq("notification_sent", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (matches && matches.length > 0) {
        const resend = new Resend(process.env.RESEND_API_KEY);

        const matchesSubjectGate = auditText(`[Marketplace] ${matches.length} novo(s) match(es) detectado(s)`);
        const matchesHtmlGate = auditHtml(`
            <h2>Novos matches no Marketplace de Capitais</h2>
            <p>${matches.length} match(es) encontrado(s) pelo engine automatizado.</p>
            <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
              <tr><th>Ativo</th><th>Tipo</th><th>Valor Face</th><th>Score</th><th>Comprador</th></tr>
              ${matches.map((m: any) => `
                <tr>
                  <td>${m.cm_asset_listings?.anonymous_id ?? '-'}</td>
                  <td>${m.cm_asset_listings?.asset_type ?? '-'}</td>
                  <td>R$ ${Number(m.cm_asset_listings?.valor_face ?? 0).toLocaleString('pt-BR')}</td>
                  <td>${m.score}/100</td>
                  <td>${m.investor_demands?.nome_contato ?? '-'}</td>
                </tr>
              `).join('')}
            </table>
            <p style="margin-top:16px;color:#666;">Acesse a Mesa de Operações para gerenciar.</p>
          `);
        if (matchesHtmlGate.blocking.length > 0) console.error("[cm/matches/run] Brand Guardian bloqueou:", matchesHtmlGate.blocking);
        await resend.emails.send({
          from: "V3 Partners <deal@v3partners.com.br>",
          to: ["joao.lemos@v3partners.com.br"],
          subject: matchesSubjectGate.corrected,
          html: matchesHtmlGate.corrected,
        });

        // Notifica os Partners de origem de cada lado (push real + in-app), alem do e-mail
        // interno acima. Achado 13/08/2026, mesma causa raiz do bug de id ausente no select
        // (corrigido acima): "id" nunca era selecionado, entao matchIds ficava sempre vazio e
        // notification_sent nunca era marcado -- os mesmos matches antigos reapareciam e
        // reenviavam e-mail em toda execucao, indefinidamente.
        for (const m of matches as any[]) {
          const listing = m.cm_asset_listings;
          const demand = m.investor_demands;
          if (listing?.originator_profile_id) {
            void createNotification({
              user_id: listing.originator_profile_id,
              title: `Novo match para ${listing.anonymous_id}`,
              message: `Comprador ${demand?.nome_contato ?? "identificado"} (score ${m.score}/100) pro ativo que você originou.`,
              type: "marketplace",
              action_url: "/meus-ativos",
            });
          }
          if (demand?.origin_partner_id) {
            void createNotification({
              user_id: demand.origin_partner_id,
              title: `Novo match para ${demand.nome_contato}`,
              message: `Ativo ${listing?.anonymous_id ?? "identificado"} (score ${m.score}/100) compatível com o comprador que você indicou.`,
              type: "marketplace",
              action_url: "/meus-compradores",
            });
          }
        }

        const matchIds = matches.map((m: any) => m.id).filter(Boolean);
        if (matchIds.length > 0) {
          await svc().from("demand_matches").update({ notification_sent: true }).in("id", matchIds);
        }
      }
    } catch (emailErr) {
      console.error("[CM Matchmaking] Email notification failed:", emailErr);
    }
  }

  return NextResponse.json({
    success: true,
    matches_created: newMatches,
    message: newMatches > 0
      ? `${newMatches} match(es) criado(s). Notificação enviada.`
      : "Nenhum novo match encontrado.",
  });
}
