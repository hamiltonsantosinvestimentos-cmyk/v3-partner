import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as sc } from "@supabase/supabase-js";
import { Resend } from "resend";

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
          score, match_reasons,
          investor_demands(nome_contato, email),
          cm_asset_listings:listing_id(anonymous_id, asset_type, valor_face, desagio_pretendido)
        `)
        .not("listing_id", "is", null)
        .eq("notification_sent", false)
        .order("created_at", { ascending: false })
        .limit(20);

      if (matches && matches.length > 0) {
        const resend = new Resend(process.env.RESEND_API_KEY);

        await resend.emails.send({
          from: "V3 Partners <deal@v3partners.com.br>",
          to: ["joao.lemos@v3partners.com.br"],
          subject: `[Marketplace] ${matches.length} novo(s) match(es) detectado(s)`,
          html: `
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
          `,
        });

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
