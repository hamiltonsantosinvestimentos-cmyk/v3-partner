import { NextResponse } from "next/server";
import { requireDeskActor, serviceClient } from "@/lib/ma/transferir-mesa";

// GET /api/ma/setores: dicionário de setores ativos (deal_sector_codes), só para a equipe.
// Alimenta o modal "Confirmar classificação" (bloco C). Ordem alfabética pt-BR pelo rótulo.
export async function GET() {
  const ator = await requireDeskActor();
  if (!ator.ok) return ator.res;
  const { data, error } = await serviceClient().from("deal_sector_codes").select("code, label").eq("active", true);
  if (error) return NextResponse.json({ error: "Não foi possível carregar os setores." }, { status: 500 });
  const setores = ((data ?? []) as { code: string; label: string }[]).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  return NextResponse.json({ setores });
}
