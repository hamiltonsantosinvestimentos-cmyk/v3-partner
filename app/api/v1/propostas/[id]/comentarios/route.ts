// GET /api/v1/propostas/{id}/comentarios — só leitura. Mensagens da sala do partner ligadas à
// proposta (as que ele vê na plataforma). Notas internas da mesa (mesa_comments) nunca saem.
import type { NextRequest } from "next/server";
import { executar, propostaDoPartner } from "@/lib/api-v1/rota";
import { ErroApi } from "@/lib/api-v1/http";
import { salaDoPartner } from "@/lib/chat-partners";
import { comentarioPublico } from "@/lib/api-v1/visao-partner";

export const dynamic = "force-dynamic";

const POR_PAGINA = 50;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return executar(req, "propostas:ler", "GET /propostas/{id}/comentarios", async (ctx, db) => {
    await propostaDoPartner(db, ctx, id, "id");
    const sp = req.nextUrl.searchParams;
    let q = db.from("chat_messages")
      .select("created_at, sender_name, content, anexos")
      .eq("room_id", salaDoPartner(ctx.partnerId))
      .eq("proposta_id", id)
      .order("created_at", { ascending: true })
      .limit(POR_PAGINA + 1);
    for (const nome of ["desde", "cursor"] as const) {
      const v = sp.get(nome);
      if (!v) continue;
      const t = new Date(nome === "cursor" ? Buffer.from(v, "base64url").toString("utf8") : v);
      if (Number.isNaN(t.getTime())) throw new ErroApi(400, "dados_invalidos", `${nome} inválido.`);
      q = q.gt("created_at", t.toISOString());
    }
    const { data, error } = await q;
    if (error) throw error;
    const linhas = (data ?? []) as Record<string, unknown>[];
    const pagina = linhas.slice(0, POR_PAGINA);
    const proxima = linhas.length > POR_PAGINA ? Buffer.from(String(pagina[pagina.length - 1].created_at)).toString("base64url") : null;
    return { corpo: { comentarios: pagina.map(comentarioPublico), proxima_pagina: proxima }, proposalId: id };
  });
}
