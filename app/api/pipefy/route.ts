import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { mapPhaseToStage, getCardField, parseBRCurrency } from "@/lib/pipefy-utils";

const PIPEFY_API = "https://api.pipefy.com/graphql";

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function pipefyQuery(token: string, query: string, variables?: Record<string, unknown>) {
  const res = await fetch(PIPEFY_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0].message);
  return json.data;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, token, pipeId, cardData, cardId, phaseId, userId } = body;

    if (!token) return NextResponse.json({ success: false, error: "Token obrigatório" }, { status: 400 });

    if (action === "test") {
      const data = await pipefyQuery(token, `query { me { id name email } }`);
      return NextResponse.json({ success: true, data: data.me });
    }

    if (action === "get_pipe") {
      if (!pipeId) return NextResponse.json({ success: false, error: "pipeId obrigatório" }, { status: 400 });
      const data = await pipefyQuery(token, `query($id: ID!) { pipe(id: $id) { id name phases { id name } } }`, { id: pipeId });
      return NextResponse.json({ success: true, data: data.pipe });
    }

    if (action === "create_card") {
      if (!pipeId || !cardData) return NextResponse.json({ success: false, error: "pipeId e cardData obrigatórios" }, { status: 400 });
      const mutation = `mutation($input: CreateCardInput!) { createCard(input: $input) { card { id title } } }`;
      const data = await pipefyQuery(token, mutation, { input: { pipe_id: pipeId, title: cardData.title, fields_attributes: cardData.fields ?? [] } });
      return NextResponse.json({ success: true, data: data.createCard.card });
    }

    if (action === "move_card") {
      if (!cardId || !phaseId) return NextResponse.json({ success: false, error: "cardId e phaseId obrigatórios" }, { status: 400 });
      const mutation = `mutation($input: MoveCardToPhaseInput!) { moveCardToPhase(input: $input) { card { id current_phase { name } } } }`;
      const data = await pipefyQuery(token, mutation, { input: { card_id: cardId, destination_phase_id: phaseId } });
      return NextResponse.json({ success: true, data: data.moveCardToPhase.card });
    }

    // ── Sincroniza todos os cards do pipe M&A com o Supabase ──────────────────
    if (action === "sync_ma") {
      if (!token || !pipeId) return NextResponse.json({ success: false, error: "token e pipeId obrigatórios" }, { status: 400 });

      // Busca todos os cards do pipe via allCards (pipeId como String)
      const query = `query($pipeId: ID!) {
        allCards(pipeId: $pipeId, first: 50) {
          edges {
            node {
              id
              title
              current_phase { id name }
              fields { field { label } value }
            }
          }
        }
      }`;

      const data = await pipefyQuery(token, query, { pipeId: String(pipeId) });
      const cards = data.allCards?.edges?.map((e: { node: unknown }) => e.node) ?? [];

      const supabase = serviceClient();

      // Busca qualquer usuário admin/gestao para usar como created_by fallback
      let adminId: string | null = null;
      for (const role of ["ADMIN", "GESTAO", "MESA_OPERACIONAL"]) {
        const { data: u } = await supabase.from("profiles").select("id").eq("role", role).limit(1).single();
        if (u?.id) { adminId = u.id; break; }
      }
      // Último fallback: qualquer usuário da tabela
      if (!adminId) {
        const { data: u } = await supabase.from("profiles").select("id").limit(1).single();
        adminId = u?.id ?? null;
      }
      if (!adminId) return NextResponse.json({ success: false, error: "Nenhum usuário encontrado no banco" }, { status: 500 });

      let synced = 0;
      for (const card of cards) {
        const fields: Array<{ field: { label: string }; value: string }> = card.fields ?? [];
        // Campos: "nome do cliente ou ativo", "nome do partner", "valor estimado", "e-mail do contato"
        const company = getCardField(fields, "nome do cliente", "cliente ou ativo", "nome da empresa", "empresa", "company", "alvo", "target", "ativo") ?? card.title ?? "Sem nome";
        const rawValue = getCardField(fields, "valor estimado", "valor do deal", "valor do negocio", "valor", "value", "deal", "montante", "ticket", "preco", "preço");
        const dealValue = rawValue ? parseBRCurrency(rawValue) : null;
        const sector = getCardField(fields, "setor", "sector", "segmento", "industria", "indústria", "ramo");
        const contactEmail = getCardField(fields, "e-mail do contato", "email do contato", "e-mail", "email", "contato");
        const partnerName = getCardField(fields, "nome do partner", "nome partner", "partner", "parceiro", "responsavel", "responsável", "originador");
        const notes = getCardField(fields, "observ", "descri", "nota");

        // Tenta achar o partner pelo nome (qualquer role — inclui PARTNER_PRO)
        let partnerId: string | null = null;
        if (partnerName) {
          // Busca por nome completo exato (case-insensitive) primeiro
          const { data: p1 } = await supabase
            .from("profiles").select("id")
            .ilike("full_name", partnerName.trim())
            .in("role", ["PARTNER", "PARTNER_PRO", "GESTAO", "ADMIN"])
            .limit(1).maybeSingle();
          if (p1?.id) {
            partnerId = p1.id;
          } else {
            // Fallback: busca parcial por qualquer parte do nome
            const { data: p2 } = await supabase
              .from("profiles").select("id")
              .ilike("full_name", `%${partnerName.trim()}%`)
              .in("role", ["PARTNER", "PARTNER_PRO", "GESTAO", "ADMIN"])
              .limit(1).maybeSingle();
            partnerId = p2?.id ?? null;
          }
        }
        // Fallback: e-mail do contato
        if (!partnerId && contactEmail) {
          const { data: p } = await supabase
            .from("profiles").select("id")
            .ilike("email", contactEmail.trim())
            .limit(1).maybeSingle();
          partnerId = p?.id ?? null;
        }

        const stage = mapPhaseToStage(card.current_phase?.name ?? "");
        const code = `MA-PIPEFY-${card.id}`;
        // assigned_to: APENAS o partner identificado pelo nome; nunca usa userId (evita
        // atribuir todos os deals a quem disparou o sync)
        const assignedTo = partnerId ?? adminId;
        const createdBy = partnerId || userId || adminId;

        await supabase.from("ma_deals").upsert({
          code,
          title: company,
          target_company: company,
          sector: sector ?? null,
          deal_value: dealValue,
          stage,
          notes: [notes, partnerName ? `Partner: ${partnerName}` : null, contactEmail ? `Contato: ${contactEmail}` : null].filter(Boolean).join("\n") || null,
          created_by: createdBy,
          assigned_to: assignedTo,
          updated_at: new Date().toISOString(),
        }, { onConflict: "code" });

        synced++;
      }

      return NextResponse.json({ success: true, synced, total: cards.length });
    }

    return NextResponse.json({ success: false, error: "Ação desconhecida" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
