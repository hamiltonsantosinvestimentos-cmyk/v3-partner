import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyDealPartner, requireDeskActor, rpcErrorResponse, serviceClient } from "@/lib/ma/transferir-mesa";

// POST /api/ma/destino/[id]/confirmar-classificacao
// BRIEF Mesa M&A bloco C (30/10/2026). Ação irreversível: emite o código (V3-BA ou V3-CR) por
// next_v3_code() e consome um número da série. Na Bolsa grava também o tipo do ativo. A função SQL
// é idempotente (segunda chamada devolve o código já emitido) e recusa setor fora do dicionário.
const Corpo = z.object({
  destino: z.enum(["bolsa", "credito"], { message: "Mesa de destino inválida." }),
  setor: z.string({ message: "Escolha o setor." }).trim().regex(/^[A-Z]{3}$/, "Escolha um setor do dicionário."),
  asset_type: z.string().trim().max(40).optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ator = await requireDeskActor();
  if (!ator.ok) return ator.res;

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Registro inválido." }, { status: 400 });
  }
  const parsed = Corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }
  const { destino, setor, asset_type } = parsed.data;

  const db = serviceClient();
  // O deal de origem serve só para o aviso genérico ao partner.
  const tabela = destino === "bolsa" ? "cm_asset_listings" : "credit_desk_proposals";
  const { data: registro } = await db.from(tabela).select("ma_deal_id").eq("id", id).single();

  const { data, error } = await db.rpc("ma_desk_confirm_classification", {
    p_registro: id,
    p_actor: ator.actor.userId,
    p_destino: destino,
    p_setor: setor,
    p_asset_type: asset_type ?? null,
  });
  if (error) return rpcErrorResponse(error);

  const resultado = data as { codigo: string; ja_emitido: boolean };
  const dealId = (registro as { ma_deal_id: string | null } | null)?.ma_deal_id;
  if (dealId && !resultado.ja_emitido) await notifyDealPartner(db, dealId, "classificacao");

  return NextResponse.json({ ok: true, ...resultado });
}
