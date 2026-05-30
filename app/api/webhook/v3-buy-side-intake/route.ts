import { NextRequest, NextResponse } from "next/server";
import { createClient as sc } from "@supabase/supabase-js";

function svc() {
  return sc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

async function sendNotification(demand: {
  id: string;
  nome_contato: string;
  empresa?: string;
  setores: string[];
  ticket_min: number;
  ticket_max: number;
}, matchesCount: number) {
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);

  const setoresStr = demand.setores.join(", ");
  const ticketRange = `R$ ${(demand.ticket_min / 1e6).toFixed(1)}M – R$ ${(demand.ticket_max / 1e6).toFixed(1)}M`;

  await resend.emails.send({
    from: "Mesa M&A <no-reply@v3partners.com.br>",
    to: ["mesa@v3partners.com.br"],
    subject: `[Buy-Side] Nova demanda — ${demand.nome_contato}${demand.empresa ? ` (${demand.empresa})` : ""}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; color: #333;">
        <h2 style="color: #C9A84C;">Nova Demanda Buy-Side Recebida</h2>
        <p><strong>Contato:</strong> ${demand.nome_contato}${demand.empresa ? ` — ${demand.empresa}` : ""}</p>
        <p><strong>Setores:</strong> ${setoresStr}</p>
        <p><strong>Ticket:</strong> ${ticketRange}</p>
        <p><strong>Matches encontrados:</strong> ${matchesCount}</p>
        <p><strong>ID da demanda:</strong> <code>${demand.id}</code></p>
        <hr/>
        <p style="color: #666; font-size: 12px;">
          Acesse o portal para visualizar os matches:<br/>
          <a href="https://app.v3partners.com.br/mesa-ma">app.v3partners.com.br/mesa-ma</a> → aba Buy-Side
        </p>
      </div>
    `,
  });
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 422 });
  }

  const { nome_contato, email, setores, ticket_min, ticket_max } = body;

  if (!nome_contato || !email || !Array.isArray(setores) || !setores.length || ticket_min == null || ticket_max == null) {
    return NextResponse.json({
      error: "Campos obrigatórios: nome_contato, email, setores[], ticket_min, ticket_max",
    }, { status: 422 });
  }

  const db = svc();

  // Inserir demanda
  const { data: demand, error: insertErr } = await db
    .from("investor_demands")
    .insert({
      nome_contato: String(nome_contato),
      email: String(email),
      telefone: body.telefone ? String(body.telefone) : null,
      empresa: body.empresa ? String(body.empresa) : null,
      cnpj: body.cnpj ? String(body.cnpj) : null,
      setores: setores as string[],
      ufs: Array.isArray(body.ufs) ? body.ufs as string[] : [],
      ticket_min: Number(ticket_min),
      ticket_max: Number(ticket_max),
      tipos_operacao: Array.isArray(body.tipos_operacao) ? body.tipos_operacao as string[] : [],
      criterios: body.criterios ? String(body.criterios) : null,
      origem: body.origem ? String(body.origem) : "n8n_w6",
      investor_profile_id: body.investor_profile_id ? String(body.investor_profile_id) : null,
      created_by: null,
    })
    .select()
    .single();

  if (insertErr || !demand) {
    await db.from("execution_errors").insert({
      source: "w6_buy_side",
      message: insertErr?.message ?? "Insert retornou vazio",
      severity: "error",
    });
    return NextResponse.json({ error: insertErr?.message ?? "Erro ao inserir demanda" }, { status: 500 });
  }

  // Executar matching
  const { data: matches, error: matchErr } = await db.rpc("match_deals_for_investor", {
    p_demand_id: demand.id,
  });

  if (matchErr) {
    await db.from("execution_errors").insert({
      source: "w6_buy_side",
      message: matchErr.message,
      severity: "warning",
    });
  }

  let matchesInserted = 0;
  if (matches && matches.length > 0) {
    const rows = (matches as Array<{ deal_id: string; score: number; reasons: Record<string, unknown> }>).map(m => ({
      demand_id: demand.id,
      deal_id: m.deal_id,
      score: m.score,
      match_reasons: m.reasons,
      status: "novo",
    }));

    const { error: upsertErr } = await db
      .from("demand_matches")
      .upsert(rows, { onConflict: "demand_id,deal_id", ignoreDuplicates: false });

    if (!upsertErr) matchesInserted = rows.length;
  }

  // Notificar Mesa
  let notified = false;
  try {
    await sendNotification(
      {
        id: demand.id,
        nome_contato: String(nome_contato),
        empresa: body.empresa ? String(body.empresa) : undefined,
        setores: setores as string[],
        ticket_min: Number(ticket_min),
        ticket_max: Number(ticket_max),
      },
      matchesInserted,
    );
    notified = true;
  } catch (emailErr) {
    await db.from("execution_errors").insert({
      source: "w6_buy_side",
      message: String(emailErr),
      severity: "warning",
    });
  }

  return NextResponse.json({ demand_id: demand.id, matches_found: matchesInserted, notified }, { status: 201 });
}
