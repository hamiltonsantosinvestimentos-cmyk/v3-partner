import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { notifyDealPartner, requireDeskActor, rpcErrorResponse, serviceClient } from "@/lib/ma/transferir-mesa";

// POST /api/ma/deals/[deal_id]/transferir-mesa
// BRIEF Mesa M&A bloco C (30/10/2026). O deal fica na Mesa M&A; a mesa de destino recebe um
// registro vinculado, sem código (sai na confirmação da classificação). Só ADMIN, GESTAO e
// MESA_OPERACIONAL. Toda a regra (NCNDA assinado, trava de Análise de Crédito, cliente,
// justificativa, duplicidade) mora na função SQL ma_deal_transfer_to_desk.
const Corpo = z.object({
  destino: z.enum(["bolsa", "credito"], { message: "Escolha a mesa de destino." }),
  motivo: z.string({ message: "Informe o motivo." }).trim().min(20, "O motivo precisa ter ao menos 20 caracteres.").max(2000),
  justificativa_sem_parte: z.string().trim().max(2000).optional(),
  v3_client_id: z.string().uuid("Cliente inválido.").optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ deal_id: string }> }) {
  const ator = await requireDeskActor();
  if (!ator.ok) return ator.res;

  const { deal_id } = await params;
  if (!z.string().uuid().safeParse(deal_id).success) {
    return NextResponse.json({ error: "Deal inválido." }, { status: 400 });
  }
  const parsed = Corpo.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, { status: 422 });
  }
  const { destino, motivo, justificativa_sem_parte, v3_client_id } = parsed.data;

  const db = serviceClient();
  const { data, error } = await db.rpc("ma_deal_transfer_to_desk", {
    p_deal: deal_id,
    p_actor: ator.actor.userId,
    p_destino: destino,
    p_motivo: motivo,
    p_justificativa_sem_parte: justificativa_sem_parte ?? null,
    p_v3_client_id: v3_client_id ?? null,
  });
  if (error) return rpcErrorResponse(error);

  // Aviso genérico ao partner originador: com await, sem desfazer a transferência se falhar.
  await notifyDealPartner(db, deal_id, "transferencia");

  return NextResponse.json({ ok: true, ...(data as Record<string, unknown>) });
}
