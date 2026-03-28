import { NextRequest, NextResponse } from "next/server";

const PIPEFY_API = "https://api.pipefy.com/graphql";

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
    const { action, token, pipeId, cardData, cardId, phaseId } = body;

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

    return NextResponse.json({ success: false, error: "Ação desconhecida" }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
